import { callLlm, type LlmContent } from "./_ai/callLlm.js";
import { cvEmploymentPromptV1 } from "./_ai/prompts/cvEmployment.v1.js";
import { cvEmploymentSchemaV1 } from "./_ai/schemas/cvEmployment.v1.js";
import {
  authenticateRequest,
  getClientIp,
  isDeployedEnvironment,
} from "./_cvParser/auth.js";
import {
  expandCollapsedRoles,
  findExperienceArray,
  normalizeExperienceEntry,
} from "./_cvParser/employmentExtraction.js";
import { errorResponse, jsonResponse } from "./_cvParser/errors.js";
import {
  decodeTextFile,
  inferMimeType,
  isFileBufferConsistentWithMimeType,
  isSupportedFile,
  MAX_FILE_SIZE_BYTES,
  toParsedUploadFile,
} from "./_cvParser/fileUpload.js";
import {
  buildSentryContext,
  captureApiException,
  captureApiMessage,
  flushSentry,
  IS_API_SENTRY_TRACING_ENABLED,
  SENTRY_AGENT_NAME,
  SENTRY_AI_RECORD_INPUTS,
  SENTRY_AI_RECORD_OUTPUTS,
} from "./_cvParser/sentry.js";
import {
  extractOpenAiErrorRecord,
  normalizeUpstreamErrorCode,
} from "./_cvParser/upstreamErrors.js";
import { createRateLimiter } from "./_shared/rateLimiter.js";

const DEFAULT_MODEL = "gpt-4.1-mini";
const INITIAL_MAX_OUTPUT_TOKENS = 700;
const RETRY_MAX_OUTPUT_TOKENS = 3_000;

const parseCvRateLimiter = createRateLimiter({
  max: 10,
  windowMs: 60_000,
});

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

    if (authResult.kind === "open" && isDeployedEnvironment()) {
      return errorResponse("CV_PARSER_NOT_CONFIGURED");
    }

    if (authResult.kind === "unauthenticated") {
      return errorResponse("CV_PARSER_UNAUTHORIZED");
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
      prompt: cvEmploymentPromptV1,
      schema: cvEmploymentSchemaV1,
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

      const normalizedExperiences = extractedExperiences.map((item) =>
        normalizeExperienceEntry(item),
      );
      const experiences = expandCollapsedRoles(normalizedExperiences);

      return jsonResponse({ experiences, model });
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
