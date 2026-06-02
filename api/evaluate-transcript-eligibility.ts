import { callLlm, type LlmContent } from "./_ai/callLlm.js";
import { transcriptEligibilityPromptV1 } from "./_ai/prompts/transcriptEligibility.v1.js";
import { transcriptEligibilitySchemaV1 } from "./_ai/schemas/transcriptEligibility.v1.js";
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

  const assessment = withContextDefaults(
    llmResult.parsed as Record<string, unknown>,
    context,
  );

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
        evaluationSource: "local_openai",
        fileName: file.name || "transcript",
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
      evaluationSource: "fallback_response",
      fileName: file.name || "transcript",
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
    evaluationSource: "external_service",
    fileName: file.name || "transcript",
    latencyMs: Date.now() - startedAt,
    model: "transcript-eligibility-service",
    output: assessment as Record<string, unknown>,
    provider: "render_service",
  });

  return jsonResponse(assessment, 200);
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

