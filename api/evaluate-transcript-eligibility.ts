import { callLlm, type LlmContent } from "./_ai/callLlm.js";
import { transcriptEligibilityPromptV2 } from "./_ai/prompts/transcriptEligibility.v2.js";
import { transcriptEligibilitySchemaV2 } from "./_ai/schemas/transcriptEligibility.v2.js";
import {
  decodeTextFile,
  inferMimeType,
  isFileBufferConsistentWithMimeType,
  isSupportedFile,
  MAX_FILE_SIZE_BYTES,
  type ParsedUploadFile,
  toParsedUploadFile,
} from "./_documentParser/fileUpload.js";
import {
  parseContext,
  type TranscriptEligibilityRequestContext,
} from "./_eligibility/context.js";
import {
  applyEligibilityResolution,
  buildFallbackResponse,
  withContextDefaults,
} from "./_eligibility/assessment.js";
import { captureTranscriptAiGeneration } from "./_shared/posthogAiObservability.js";
// Importing initializes Sentry as a side effect, which also activates the
// Sentry.startSpan tracing inside _ai/callLlm.ts on this route.
import {
  buildSentryContext,
  captureApiException,
  flushSentry,
} from "./_shared/sentry.js";

const DEFAULT_MODEL = "gpt-4.1-mini";
const INITIAL_MAX_OUTPUT_TOKENS = 3_000;
const RETRY_MAX_OUTPUT_TOKENS = 7_000;

function getSafeFileExtension(fileName: string) {
  const match = /\.([a-z0-9]{1,12})$/i.exec(fileName.trim());
  return match?.[1]?.toLowerCase();
}

function getFileSizeBucket(size: number) {
  if (!Number.isFinite(size) || size <= 0) {
    return "unknown";
  }

  if (size <= 10 * 1024) {
    return "0-10kb";
  }

  if (size <= 100 * 1024) {
    return "10-100kb";
  }

  if (size <= 1024 * 1024) {
    return "100kb-1mb";
  }

  if (size <= MAX_FILE_SIZE_BYTES) {
    return "1-5mb";
  }

  return "over-5mb";
}

function buildTranscriptDocumentMetadata(
  file: ParsedUploadFile,
  mimeType: string,
) {
  return {
    fileExtension: getSafeFileExtension(file.name),
    kind: "transcript" as const,
    mimeType: mimeType || "application/octet-stream",
    sizeBucket: getFileSizeBucket(file.size),
  };
}

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

/**
 * Schema v2 has the model emit plain numeric academic results (wamNumeric, gpaNumeric,
 * gpaScaleNumeric) alongside the text evidence fields. Fold the numbers into the corresponding
 * extracted fields' normalizedValue so the downstream evaluators compare exact numbers instead of
 * regex-parsing free text. The text field's originalValue (the verbatim transcript wording) is
 * preserved.
 */
function foldNumericAcademicFields(assessment: Record<string, unknown>) {
  const academicPerformance =
    assessment.academicPerformance && typeof assessment.academicPerformance === "object"
      ? (assessment.academicPerformance as Record<string, unknown>)
      : undefined;
  if (!academicPerformance) {
    return;
  }

  const numericToField: Array<[string, string]> = [
    ["wamNumeric", "gradeAverageOrWam"],
    ["gpaNumeric", "gpa"],
    ["gpaScaleNumeric", "gpaScale"],
  ];

  for (const [numericKey, fieldKey] of numericToField) {
    const numeric = academicPerformance[numericKey];
    if (typeof numeric !== "number" || !Number.isFinite(numeric)) {
      continue;
    }
    const existing =
      academicPerformance[fieldKey] && typeof academicPerformance[fieldKey] === "object"
        ? (academicPerformance[fieldKey] as Record<string, unknown>)
        : undefined;
    academicPerformance[fieldKey] = {
      confidence: typeof existing?.confidence === "number" ? existing.confidence : 0.9,
      missingOrAmbiguous: false,
      normalizedValue: String(numeric),
      originalValue:
        typeof existing?.originalValue === "string" ? existing.originalValue : String(numeric),
    };
  }
}

async function evaluateWithLocalModel(
  file: ParsedUploadFile,
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
    prompt: transcriptEligibilityPromptV2,
    schema: transcriptEligibilitySchemaV2,
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

  const parsed = llmResult.parsed as Record<string, unknown>;
  foldNumericAcademicFields(parsed);

  // Stamp the exact (model, prompt, schema) tuple so every stored result and telemetry event can
  // be attributed to the versions that produced it.
  parsed.modelId = model;
  parsed.promptVersion = `${transcriptEligibilityPromptV2.id}@v${transcriptEligibilityPromptV2.version}`;
  parsed.schemaVersion = `${transcriptEligibilitySchemaV2.id}@v${transcriptEligibilitySchemaV2.version}`;

  const assessment = withContextDefaults(parsed, context);

  return {
    assessment,
    model,
    tokenUsage: {
      inputTokens: llmResult.tokens.inputTokens,
      outputTokens: llmResult.tokens.outputTokens,
    },
  };
}

async function forwardToEligibilityService(
  file: ParsedUploadFile,
  fileBuffer: ArrayBuffer,
  mimeType: string,
  context: TranscriptEligibilityRequestContext,
) {
  const serviceUrl = process.env.ELIGIBILITY_SERVICE_URL?.trim();
  const startedAt = Date.now();
  const document = buildTranscriptDocumentMetadata(file, mimeType);

  if (!serviceUrl) {
    const localAssessment = await evaluateWithLocalModel(
      file,
      fileBuffer,
      mimeType,
      context,
    );

    if (localAssessment) {
      await captureTranscriptAiGeneration({
        context: context as Record<string, unknown>,
        document,
        evaluationSource: "local_openai",
        latencyMs: Date.now() - startedAt,
        model: localAssessment.model,
        output: localAssessment.assessment,
        provider: "openai",
        tokenUsage: localAssessment.tokenUsage,
      });

      return jsonResponse(localAssessment.assessment, 200);
    }

    const fallbackAssessment = buildFallbackResponse(context);
    await captureTranscriptAiGeneration({
      context: context as Record<string, unknown>,
      document,
      evaluationSource: "fallback_response",
      latencyMs: Date.now() - startedAt,
      model: "fallback",
      output: fallbackAssessment as Record<string, unknown>,
      provider: "none",
    });

    return jsonResponse(fallbackAssessment, 200);
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

  const assessment =
    payload && typeof payload === "object"
      ? applyEligibilityResolution(payload as Record<string, unknown>, context)
      : buildFallbackResponse(context);

  await captureTranscriptAiGeneration({
    context: context as Record<string, unknown>,
    document,
    evaluationSource: "external_service",
    latencyMs: Date.now() - startedAt,
    model: "transcript-eligibility-service",
    output: assessment as Record<string, unknown>,
    provider: "render_service",
  });

  return jsonResponse(assessment, 200);
}

async function handleWebRequest(request: Request) {
  try {
    return await handleEligibilityRequest(request);
  } catch (error) {
    await captureApiException(error, buildSentryContext(request));
    await flushSentry();
    return errorResponse(
      "Transcript eligibility evaluation failed.",
      "ELIGIBILITY_UNEXPECTED_ERROR",
      500,
    );
  }
}

async function handleEligibilityRequest(request: Request) {
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
