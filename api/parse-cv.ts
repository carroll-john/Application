import { callLlm, type LlmContent } from "./_ai/callLlm.js";
import { cvRecognitionPromptV2 } from "./_ai/prompts/cvRecognition.v2.js";
import { cvRecognitionSchemaV2 } from "./_ai/schemas/cvRecognition.v2.js";
import {
  authenticateRequest,
  getClientIp,
  isDeployedEnvironment,
} from "./_documentParser/auth.js";
import {
  expandCollapsedRoles,
  findExperienceArray,
  normalizeExperienceEntry,
} from "./_documentParser/kinds/cv/extraction.js";
import { errorResponse, jsonResponse } from "./_documentParser/errors.js";
import {
  decodeTextFile,
  inferMimeType,
  isFileBufferConsistentWithMimeType,
  isSupportedFile,
  MAX_FILE_SIZE_BYTES,
  toParsedUploadFile,
} from "./_documentParser/fileUpload.js";
import { getCvParserAccessError } from "./_documentParser/cvParserAccess.js";
import {
  buildSentryContext,
  captureApiException,
  captureApiMessage,
  flushSentry,
  IS_API_SENTRY_TRACING_ENABLED,
  SENTRY_AGENT_NAME,
  SENTRY_AI_RECORD_INPUTS,
  SENTRY_AI_RECORD_OUTPUTS,
} from "./_documentParser/sentry.js";
import {
  extractOpenAiErrorRecord,
  normalizeUpstreamErrorCode,
} from "./_documentParser/upstreamErrors.js";
import { createRateLimiter } from "./_shared/rateLimiter.js";
import {
  AssessmentApiError,
  requireTreatmentInvitation,
} from "./_assessment/server.js";
import { isUcPreApplicationParseRequest } from "../src/lib/ucPreApplicationParseContract.js";

const DEFAULT_MODEL = "gpt-4.1-mini";
const INITIAL_MAX_OUTPUT_TOKENS = 1_800;
const RETRY_MAX_OUTPUT_TOKENS = 6_000;

const parseCvRateLimiter = createRateLimiter({
  max: 10,
  windowMs: 60_000,
});

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(record: Record<string, unknown>, key: string) {
  return typeof record[key] === "string" ? record[key] : "";
}

function arrayValue(record: Record<string, unknown>, key: string) {
  return Array.isArray(record[key]) ? record[key] : [];
}

function normalizeRecognitionPayload(parsed: unknown) {
  const payload = asRecord(parsed);
  const applicant = asRecord(payload.applicant);
  const normalizedApplicant = {
    firstName: stringValue(applicant, "firstName"),
    lastName: stringValue(applicant, "lastName"),
    middleName: stringValue(applicant, "middleName"),
    phone: stringValue(applicant, "phone"),
    title: stringValue(applicant, "title"),
  };
  const rawExperiences = findExperienceArray(parsed) ?? [];
  const normalizedExperiences = rawExperiences.map((item) =>
    normalizeExperienceEntry(item),
  );
  const expandedExperiences = expandCollapsedRoles(normalizedExperiences);
  const experiences = expandedExperiences.map((experience, index) => {
    const recognition = asRecord(rawExperiences[index]);
    const rawSkillLevel = recognition.oscaSkillLevel;
    const oscaSkillLevel =
      typeof rawSkillLevel === "number" && rawSkillLevel >= 1 && rawSkillLevel <= 5
        ? Math.trunc(rawSkillLevel)
        : 0;
    const rawConfidence = stringValue(recognition, "oscaConfidence");
    const oscaConfidence = ["high", "medium", "low"].includes(rawConfidence)
      ? rawConfidence
      : "low";

    return {
        ...experience,
        oscaConfidence,
        oscaOccupationCode: stringValue(recognition, "oscaOccupationCode"),
        oscaOccupationTitle: stringValue(recognition, "oscaOccupationTitle"),
        oscaRationale: stringValue(recognition, "oscaRationale"),
        oscaSkillLevel,
      };
  });

  const professionalAccreditations = arrayValue(
    payload,
    "professionalAccreditations",
  ).map((value) => {
    const item = asRecord(value);
    return {
      name: stringValue(item, "name"),
      status: stringValue(item, "status"),
    };
  });
  const secondaryQualifications = arrayValue(payload, "secondaryQualifications").map(
    (value) => {
      const item = asRecord(value);
      return {
        country: stringValue(item, "country"),
        qualification: stringValue(item, "qualification"),
        school: stringValue(item, "school"),
        state: stringValue(item, "state"),
        type: stringValue(item, "type"),
        year: stringValue(item, "year"),
      };
    },
  );
  const tertiaryQualifications = arrayValue(payload, "tertiaryQualifications").map(
    (value) => {
      const item = asRecord(value);
      return {
        completed: item.completed === true,
        country: stringValue(item, "country"),
        courseName: stringValue(item, "courseName"),
        endMonth: stringValue(item, "endMonth"),
        endYear: stringValue(item, "endYear"),
        institution: stringValue(item, "institution"),
        level: stringValue(item, "level"),
        startMonth: stringValue(item, "startMonth"),
        startYear: stringValue(item, "startYear"),
      };
    },
  );

  return {
    applicant: normalizedApplicant,
    experiences,
    professionalAccreditations,
    secondaryQualifications,
    tertiaryQualifications,
  };
}

async function handleWebRequest(request: Request) {
  try {
    if (request.method !== "POST") {
      return errorResponse("CV_PARSER_METHOD_NOT_ALLOWED");
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();

    if (!apiKey) {
      return errorResponse("CV_PARSER_NOT_CONFIGURED");
    }

    const authResult = await authenticateRequest(request);
    if (authResult.kind !== "authenticated" && isUcPreApplicationParseRequest(request)) {
      try {
        await requireTreatmentInvitation(request);
      } catch (error) {
        if (error instanceof AssessmentApiError) {
          return errorResponse("CV_PARSER_INVITATION_REQUIRED");
        }
        throw error;
      }
    }
    const accessError = getCvParserAccessError(
      authResult.kind,
      request,
      isDeployedEnvironment(),
    );

    if (accessError) {
      return errorResponse(accessError);
    }

    const rateLimitKey =
      authResult.kind === "authenticated"
        ? `user:${authResult.userId}`
        : `ip:${getClientIp(request) ?? "unknown"}`;

    if (parseCvRateLimiter.isLimited(rateLimitKey)) {
      return errorResponse("CV_PARSER_RATE_LIMITED");
    }

    const formData = await request.formData();
    const file = toParsedUploadFile(formData.get("file"));

    if (!file) {
      return errorResponse("CV_PARSER_FILE_REQUIRED");
    }

    if (!isSupportedFile(file)) {
      return errorResponse("CV_PARSER_FILE_UNSUPPORTED");
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return errorResponse("CV_PARSER_FILE_TOO_LARGE");
    }

    const fileBuffer = await file.arrayBuffer();
    const mimeType = inferMimeType(file);
    const isPlainTextFile = mimeType === "text/plain";

    if (!isFileBufferConsistentWithMimeType(fileBuffer, mimeType)) {
      return errorResponse("CV_PARSER_FILE_UNSUPPORTED");
    }

    const model = process.env.OPENAI_CV_PARSER_MODEL?.trim() || DEFAULT_MODEL;

    const attachments: LlmContent[] = [];

    if (isPlainTextFile) {
      const cvText = decodeTextFile(fileBuffer);

      if (!cvText) {
        return errorResponse("CV_PARSER_TEXT_FILE_EMPTY");
      }

      attachments.push({ kind: "text", text: `CV text:\n${cvText}` });
    } else {
      attachments.push({
        kind: "file",
        filename: file.name,
        mimeType,
        data: fileBuffer,
      });
    }

    const llmResult = await callLlm({
      provider: "openai",
      apiKey,
      model,
      prompt: cvRecognitionPromptV2,
      schema: cvRecognitionSchemaV2,
      attachments,
      initialMaxOutputTokens: INITIAL_MAX_OUTPUT_TOKENS,
      retryMaxOutputTokens: RETRY_MAX_OUTPUT_TOKENS,
      enableCodeInterpreter: !isPlainTextFile,
      trace: {
        enabled: IS_API_SENTRY_TRACING_ENABLED,
        agentName: SENTRY_AGENT_NAME,
        recordInputs: SENTRY_AI_RECORD_INPUTS,
        recordOutputs: SENTRY_AI_RECORD_OUTPUTS,
        agentSpanAttributes: {
          "cv_parser.file_mime_type": mimeType,
          "cv_parser.file_size_bytes": file.size,
        },
      },
    });

    if (llmResult.status === "upstream_error") {
      const upstreamError = extractOpenAiErrorRecord(llmResult.upstream.payload);
      const normalizedErrorCode = normalizeUpstreamErrorCode(
        llmResult.upstream.status,
        llmResult.upstream.payload,
      );

      await captureApiMessage(
        "CV parser upstream request failed",
        buildSentryContext(
          request,
          {
            model,
            openai_error: upstreamError.message ?? "unknown",
            openai_error_code: upstreamError.code ?? "unknown",
            openai_error_type: upstreamError.type ?? "unknown",
            parser_error_code: normalizedErrorCode,
            openai_status: llmResult.upstream.status,
            openai_status_text: llmResult.upstream.statusText,
          },
          {
            failure_stage: "openai_request",
          },
        ),
      );

      return errorResponse(normalizedErrorCode);
    }

    if (llmResult.status === "truncated") {
      return errorResponse("CV_PARSER_RESPONSE_TRUNCATED");
    }

    if (llmResult.status === "invalid_response") {
      const payload = llmResult.upstream.payload as
        | Record<string, unknown>
        | null
        | undefined;

      await captureApiMessage(
        "CV parser response format invalid",
        buildSentryContext(
          request,
          {
            model,
            payload_status:
              typeof payload?.status === "string" ? payload.status : "unknown",
          },
          {
            failure_stage: "response_shape",
          },
        ),
      );

      return errorResponse("CV_PARSER_RESPONSE_INVALID");
    }

    try {
      const extractedExperiences = findExperienceArray(llmResult.parsed);

      if (!extractedExperiences) {
        const payload = llmResult.upstream.payload as
          | Record<string, unknown>
          | null
          | undefined;

        await captureApiMessage(
          "CV parser response format invalid",
          buildSentryContext(
            request,
            {
              model,
              payload_status:
                typeof payload?.status === "string" ? payload.status : "unknown",
            },
            {
              failure_stage: "response_shape",
            },
          ),
        );

        return errorResponse("CV_PARSER_RESPONSE_INVALID");
      }

      const recognition = normalizeRecognitionPayload(llmResult.parsed);

      return jsonResponse({ ...recognition, model });
    } catch (error) {
      const payload = llmResult.upstream.payload as
        | Record<string, unknown>
        | null
        | undefined;

      await captureApiException(
        error,
        buildSentryContext(
          request,
          {
            model,
            payload_status:
              typeof payload?.status === "string" ? payload.status : "unknown",
          },
          {
            failure_stage: "response_parse",
          },
        ),
      );

      return errorResponse("CV_PARSER_RESPONSE_UNREADABLE");
    }
  } catch (error) {
    await captureApiException(
      error,
      buildSentryContext(request, undefined, {
        failure_stage: "handler_unhandled",
      }),
    );

    return errorResponse("CV_PARSER_UNEXPECTED_FAILURE");
  } finally {
    if (IS_API_SENTRY_TRACING_ENABLED) {
      await flushSentry();
    }
  }
}

export default {
  fetch: handleWebRequest,
};
