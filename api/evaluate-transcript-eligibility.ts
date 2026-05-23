import { callLlm, type LlmContent } from "./_ai/callLlm.js";
import { transcriptEligibilityPromptV1 } from "./_ai/prompts/transcriptEligibility.v1.js";
import { transcriptEligibilitySchemaV1 } from "./_ai/schemas/transcriptEligibility.v1.js";
import {
  decodeTextFile,
  inferMimeType,
  isFileBufferConsistentWithMimeType,
  isSupportedFile,
  MAX_FILE_SIZE_BYTES,
  toParsedUploadFile,
} from "./_documentParser/fileUpload.js";

type TranscriptEligibilityRequestContext = {
  completed?: boolean;
  courseCode?: string;
  courseTitle?: string;
  institution?: string;
  languageTestsCount?: number;
  level?: string;
};

const DEFAULT_MODEL = "gpt-4.1-mini";
const INITIAL_MAX_OUTPUT_TOKENS = 1_500;
const RETRY_MAX_OUTPUT_TOKENS = 3_500;

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
    status,
  });
}

function errorResponse(error: string, code: string, status = 400) {
  return jsonResponse({ code, error }, status);
}

function parseContext(rawValue: FormDataEntryValue | null): TranscriptEligibilityRequestContext {
  if (typeof rawValue !== "string" || !rawValue.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    const candidate = parsed as Record<string, unknown>;

    return {
      completed: typeof candidate.completed === "boolean" ? candidate.completed : undefined,
      courseCode:
        typeof candidate.courseCode === "string" ? candidate.courseCode.trim() : undefined,
      courseTitle:
        typeof candidate.courseTitle === "string" ? candidate.courseTitle.trim() : undefined,
      institution:
        typeof candidate.institution === "string" ? candidate.institution.trim() : undefined,
      languageTestsCount:
        typeof candidate.languageTestsCount === "number" ? candidate.languageTestsCount : undefined,
      level: typeof candidate.level === "string" ? candidate.level.trim() : undefined,
    };
  } catch {
    return {};
  }
}

function buildFallbackResponse(
  context: TranscriptEligibilityRequestContext,
  reason?:
    | string
    | {
        detail: string;
        title: string;
      },
) {
  const fallbackReason =
    typeof reason === "string"
      ? reason
      : reason?.detail ??
        "External eligibility service is not configured in this environment.";

  return {
    checkedAt: new Date().toISOString(),
    confidence: 0.45,
    manualReviewRequired: true,
    missingInformation: [
      fallbackReason,
      "A full transcript extraction and eligibility evaluation could not be completed automatically.",
    ],
    outcome: "insufficient_data",
    programCode: context.courseCode,
    programTitle: context.courseTitle,
    recommendedNextStep:
      "Route this application for manual admissions review or configure the eligibility service endpoint.",
    requirementsChecked: [
      {
        explanation:
          "Transcript evidence was saved, but an external evaluation service response was unavailable.",
        id: "service-availability",
        requirement: "Automated transcript eligibility evaluation availability",
        status: "unknown",
      },
    ],
    rulesVersion: "v1",
    serviceVersion: "fallback-local",
    applicantDetails: {
      institutionName: {
        confidence: context.institution ? 0.8 : 0.2,
        normalizedValue: context.institution,
        originalValue: context.institution,
      },
    },
    studyDetails: {
      completionStatus: {
        confidence: typeof context.completed === "boolean" ? 0.8 : 0.3,
        normalizedValue:
          typeof context.completed === "boolean"
            ? context.completed
              ? "completed"
              : "in_progress_or_not_completed"
            : undefined,
        originalValue:
          typeof context.completed === "boolean"
            ? context.completed
              ? "completed"
              : "not completed"
            : undefined,
      },
      highestEducationLevel: {
        confidence: context.level ? 0.75 : 0.25,
        normalizedValue: context.level,
        originalValue: context.level,
      },
    },
  };
}

function withContextDefaults(
  assessment: Record<string, unknown>,
  context: TranscriptEligibilityRequestContext,
) {
  const patched = { ...assessment };

  if (typeof patched.checkedAt !== "string" || !patched.checkedAt.trim()) {
    patched.checkedAt = new Date().toISOString();
  }

  if (!patched.programCode && context.courseCode) {
    patched.programCode = context.courseCode;
  }

  if (!patched.programTitle && context.courseTitle) {
    patched.programTitle = context.courseTitle;
  }

  if (!patched.serviceVersion) {
    patched.serviceVersion = "local-openai-fallback";
  }

  return patched;
}

async function evaluateWithLocalModel(
  file: File,
  fileBuffer: ArrayBuffer,
  mimeType: string,
  context: TranscriptEligibilityRequestContext,
) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    return null;
  }

  const attachments: LlmContent[] = [
    {
      kind: "text",
      text: `Program context:\n${JSON.stringify(context)}`,
    },
  ];

  if (mimeType === "text/plain") {
    const transcriptText = decodeTextFile(fileBuffer);

    if (transcriptText) {
      attachments.push({
        kind: "text",
        text: `Transcript content:\n${transcriptText}`,
      });
    }
  } else {
    attachments.push({
      kind: "file",
      filename: file.name,
      mimeType,
      data: fileBuffer,
    });
  }

  const model =
    process.env.OPENAI_TRANSCRIPT_ELIGIBILITY_MODEL?.trim() ||
    process.env.OPENAI_CV_PARSER_MODEL?.trim() ||
    DEFAULT_MODEL;

  const llmResult = await callLlm({
    provider: "openai",
    apiKey,
    model,
    prompt: transcriptEligibilityPromptV1,
    schema: transcriptEligibilitySchemaV1,
    attachments,
    initialMaxOutputTokens: INITIAL_MAX_OUTPUT_TOKENS,
    retryMaxOutputTokens: RETRY_MAX_OUTPUT_TOKENS,
    enableCodeInterpreter: mimeType !== "text/plain",
    trace: {
      enabled: false,
      agentName: "transcript-eligibility-evaluator",
      recordInputs: false,
      recordOutputs: false,
    },
  });

  if (llmResult.status !== "ok" || !llmResult.parsed || typeof llmResult.parsed !== "object") {
    return null;
  }

  return withContextDefaults(
    llmResult.parsed as Record<string, unknown>,
    context,
  );
}

async function forwardToEligibilityService(
  file: File,
  fileBuffer: ArrayBuffer,
  mimeType: string,
  context: TranscriptEligibilityRequestContext,
) {
  const serviceUrl = process.env.ELIGIBILITY_SERVICE_URL?.trim();

  if (!serviceUrl) {
    const localAssessment = await evaluateWithLocalModel(
      file,
      fileBuffer,
      mimeType,
      context,
    );

    if (localAssessment) {
      return jsonResponse(localAssessment, 200);
    }

    return jsonResponse(buildFallbackResponse(context), 200);
  }

  const forwardPayload = new FormData();
  const forwardBlob = new Blob([fileBuffer], { type: mimeType });
  forwardPayload.append("file", forwardBlob, file.name || "transcript");
  forwardPayload.append("context", JSON.stringify(context));

  const headers = new Headers();
  const serviceToken = process.env.ELIGIBILITY_SERVICE_TOKEN?.trim();

  if (serviceToken) {
    headers.set("authorization", `Bearer ${serviceToken}`);
  }

  const upstream = await fetch(serviceUrl, {
    body: forwardPayload,
    headers,
    method: "POST",
  });

  let payload: unknown;

  try {
    payload = (await upstream.json()) as unknown;
  } catch {
    payload = null;
  }

  if (!upstream.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : "Eligibility service request failed.";

    return errorResponse(message, "ELIGIBILITY_SERVICE_UPSTREAM_ERROR", upstream.status);
  }

  return jsonResponse(payload ?? buildFallbackResponse(context), 200);
}

async function handleWebRequest(request: Request) {
  if (request.method !== "POST") {
    return errorResponse("Method not allowed.", "ELIGIBILITY_METHOD_NOT_ALLOWED", 405);
  }

  const formData = await request.formData();
  const file = toParsedUploadFile(formData.get("file"));

  if (!file) {
    return errorResponse("Transcript file is required.", "ELIGIBILITY_FILE_REQUIRED", 400);
  }

  if (!isSupportedFile(file)) {
    return errorResponse("Unsupported transcript file type.", "ELIGIBILITY_FILE_UNSUPPORTED", 415);
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return errorResponse("Transcript file is too large.", "ELIGIBILITY_FILE_TOO_LARGE", 413);
  }

  const fileBuffer = await file.arrayBuffer();
  const mimeType = inferMimeType(file);

  if (!isFileBufferConsistentWithMimeType(fileBuffer, mimeType)) {
    return errorResponse("Transcript file content is invalid.", "ELIGIBILITY_FILE_UNSUPPORTED", 415);
  }

  const context = parseContext(formData.get("context"));

  return forwardToEligibilityService(file, fileBuffer, mimeType, context);
}

export default {
  fetch: handleWebRequest,
};

