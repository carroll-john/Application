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
import { applyDeterministicEligibilityRules } from "../src/lib/eligibility/deterministicRules.js";
import { aggregateOutcome, evaluateRequirements } from "../src/lib/eligibility/matcher.js";
import type { RequirementInstance } from "../src/lib/eligibility/requirements.js";
import type {
  EligibilityRequirementCheck,
  TranscriptExtractedData,
} from "../src/lib/eligibility/types.js";
import { captureTranscriptAiGeneration } from "./_shared/posthogAiObservability.js";

type TranscriptEligibilityRequestContext = {
  completed?: boolean;
  country?: string;
  courseCode?: string;
  courseTitle?: string;
  entryRequirementsText?: string;
  institution?: string;
  languageTestsCount?: number;
  level?: string;
  minGpaScale?: number;
  minGpaValue?: number;
  minWam?: number;
  qualificationLevelRequirement?: string;
  requirements?: RequirementInstance[];
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

    const maybeNumber = (value: unknown) =>
      typeof value === "number" && Number.isFinite(value) ? value : undefined;

    return {
      completed: typeof candidate.completed === "boolean" ? candidate.completed : undefined,
      country: typeof candidate.country === "string" ? candidate.country.trim() : undefined,
      courseCode:
        typeof candidate.courseCode === "string" ? candidate.courseCode.trim() : undefined,
      courseTitle:
        typeof candidate.courseTitle === "string" ? candidate.courseTitle.trim() : undefined,
      entryRequirementsText:
        typeof candidate.entryRequirementsText === "string"
          ? candidate.entryRequirementsText.trim()
          : undefined,
      institution:
        typeof candidate.institution === "string" ? candidate.institution.trim() : undefined,
      languageTestsCount:
        typeof candidate.languageTestsCount === "number" ? candidate.languageTestsCount : undefined,
      level: typeof candidate.level === "string" ? candidate.level.trim() : undefined,
      minGpaScale: maybeNumber(candidate.minGpaScale),
      minGpaValue: maybeNumber(candidate.minGpaValue),
      minWam: maybeNumber(candidate.minWam),
      qualificationLevelRequirement:
        typeof candidate.qualificationLevelRequirement === "string"
          ? candidate.qualificationLevelRequirement.trim()
          : undefined,
      requirements: normalizeRequirements(candidate.requirements),
    };
  } catch {
    return {};
  }
}

const SUPPORTED_REQUIREMENT_KINDS = new Set([
  "qualification_completed",
  "qualification_level",
  "academic_threshold",
  "english_proficiency",
  "work_experience",
  "field_of_study",
]);

function normalizeRequirements(value: unknown): RequirementInstance[] | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    return undefined;
  }

  const out: RequirementInstance[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const candidate = entry as Record<string, unknown>;
    if (
      typeof candidate.id !== "string" ||
      typeof candidate.kind !== "string" ||
      !SUPPORTED_REQUIREMENT_KINDS.has(candidate.kind) ||
      typeof candidate.sourceText !== "string" ||
      (candidate.weight !== "mandatory" && candidate.weight !== "alternative") ||
      !candidate.params ||
      typeof candidate.params !== "object"
    ) {
      continue;
    }
    out.push(candidate as unknown as RequirementInstance);
  }

  return out.length > 0 ? out : undefined;
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

function extractEvidence(assessment: Record<string, unknown>): TranscriptExtractedData {
  // The transcript-eligibility service / LLM produces evidence groups directly on the assessment.
  // The matcher consumes a TranscriptExtractedData shape with the same group names, so we coerce
  // by reference rather than copy.
  const ev: TranscriptExtractedData = {};
  if (assessment.applicantDetails && typeof assessment.applicantDetails === "object") {
    ev.applicantDetails = assessment.applicantDetails as TranscriptExtractedData["applicantDetails"];
  }
  if (assessment.studyDetails && typeof assessment.studyDetails === "object") {
    ev.studyDetails = assessment.studyDetails as TranscriptExtractedData["studyDetails"];
  }
  if (assessment.academicPerformance && typeof assessment.academicPerformance === "object") {
    ev.academicPerformance =
      assessment.academicPerformance as TranscriptExtractedData["academicPerformance"];
  }
  if (
    assessment.englishLanguageEvidence &&
    typeof assessment.englishLanguageEvidence === "object"
  ) {
    ev.englishLanguageEvidence =
      assessment.englishLanguageEvidence as TranscriptExtractedData["englishLanguageEvidence"];
  }
  return ev;
}

function applyRequirementsMatcher(
  assessment: Record<string, unknown>,
  context: TranscriptEligibilityRequestContext,
): Record<string, unknown> {
  const requirements = context.requirements ?? [];
  const evidence = extractEvidence(assessment);
  const checks: EligibilityRequirementCheck[] = evaluateRequirements(
    requirements,
    evidence,
    context,
  );
  const { outcome, manualReviewRequired } = aggregateOutcome(checks);

  const patched: Record<string, unknown> = { ...assessment };
  patched.requirementsChecked = checks;
  patched.outcome = outcome;
  patched.manualReviewRequired = manualReviewRequired;

  const missingFromUnknown = checks
    .filter((check) => check.status === "unknown")
    .map((check) => check.explanation);
  const existingMissing = Array.isArray(patched.missingInformation)
    ? patched.missingInformation.filter((item): item is string => typeof item === "string")
    : [];
  patched.missingInformation = Array.from(new Set([...existingMissing, ...missingFromUnknown]));

  patched.rulesVersion =
    typeof patched.rulesVersion === "string" && patched.rulesVersion.trim()
      ? `${patched.rulesVersion.trim()}+matcher-v1`
      : "matcher-v1";

  if (
    typeof patched.recommendedNextStep !== "string" ||
    !patched.recommendedNextStep.trim() ||
    outcome !== "eligible"
  ) {
    patched.recommendedNextStep =
      outcome === "ineligible"
        ? "Applicant is below one or more mandatory requirements. Route to admissions review for final decision."
        : outcome === "insufficient_data"
          ? "Provide clearer transcript evidence (completion status, WAM/GPA, English-medium completion) and route for manual review."
          : "Proceed with application submission and admissions verification.";
  }

  return patched;
}

/**
 * Decides whether to use the new RequirementInstance matcher (when the client supplied requirements
 * derived from the canonical catalog) or the legacy deterministic regex rules.
 */
function applyEligibilityResolution(
  assessment: Record<string, unknown>,
  context: TranscriptEligibilityRequestContext,
): Record<string, unknown> {
  if (context.requirements && context.requirements.length > 0) {
    return applyRequirementsMatcher(assessment, context);
  }
  return applyDeterministicEligibilityRules(assessment, context) as Record<string, unknown>;
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

  return applyEligibilityResolution(patched, context);
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

