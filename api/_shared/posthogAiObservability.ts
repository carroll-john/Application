import { getPostHogServerClient } from "./posthogServerClient.js";

type AiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

interface CaptureTranscriptAiGenerationOptions {
  context: Record<string, unknown>;
  evaluationSource: "external_service" | "fallback_response" | "local_openai";
  fileName: string;
  latencyMs: number;
  model: string;
  output: Record<string, unknown>;
  provider: string;
  tokenUsage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

const DEFAULT_POSTHOG_HOST = "https://eu.i.posthog.com";

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

function createTraceId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `trace-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeHost(value: string | undefined) {
  const normalized = (value?.trim() || DEFAULT_POSTHOG_HOST).replace(/\/+$/, "");

  if (/^https:\/\/(eu|us|app)\.posthog\.com$/i.test(normalized)) {
    if (normalized.includes("eu.")) {
      return "https://eu.i.posthog.com";
    }
    return "https://us.i.posthog.com";
  }

  return normalized;
}

function readApiKey() {
  const apiKey =
    process.env.POSTHOG_PROJECT_API_KEY?.trim() ||
    process.env.VITE_POSTHOG_KEY?.trim() ||
    "";
  return apiKey;
}

function buildDistinctId(context: Record<string, unknown>) {
  const raw = JSON.stringify({
    courseCode:
      typeof context.courseCode === "string" ? context.courseCode.trim() : undefined,
    institution:
      typeof context.institution === "string" ? context.institution.trim() : undefined,
    level: typeof context.level === "string" ? context.level.trim() : undefined,
  });
  const digest = hashString(raw);
  return `eligibility-${digest}`;
}

function summarizeRequirements(output: Record<string, unknown>) {
  if (!Array.isArray(output.requirementsChecked)) {
    return [];
  }

  return output.requirementsChecked
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const candidate = item as Record<string, unknown>;
      return {
        id: typeof candidate.id === "string" ? candidate.id : "unknown",
        reasonCode: typeof candidate.reasonCode === "string" ? candidate.reasonCode : undefined,
        status:
          candidate.status === "pass" ||
          candidate.status === "fail" ||
          candidate.status === "unknown"
            ? candidate.status
            : "unknown",
      };
    })
    .filter(Boolean) as Array<{
    id: string;
    reasonCode?: string;
    status: "pass" | "fail" | "unknown";
  }>;
}

function summarizeOutput(output: Record<string, unknown>) {
  const requirements = summarizeRequirements(output);

  return JSON.stringify(
    {
      confidence:
        typeof output.confidence === "number" ? Number(output.confidence.toFixed(4)) : null,
      manualReviewRequired:
        typeof output.manualReviewRequired === "boolean"
          ? output.manualReviewRequired
          : null,
      outcome:
        typeof output.outcome === "string" ? output.outcome : "insufficient_data",
      recommendedNextStep:
        typeof output.recommendedNextStep === "string"
          ? output.recommendedNextStep
          : "manual_review",
      requirementsChecked: requirements,
      rulesVersion: typeof output.rulesVersion === "string" ? output.rulesVersion : null,
      serviceVersion:
        typeof output.serviceVersion === "string" ? output.serviceVersion : null,
    },
    null,
    0,
  );
}

function summarizeInput(
  context: Record<string, unknown>,
  evaluationSource: CaptureTranscriptAiGenerationOptions["evaluationSource"],
  fileName: string,
) {
  return JSON.stringify(
    {
      context: {
        completed:
          typeof context.completed === "boolean" ? context.completed : undefined,
        country: typeof context.country === "string" ? context.country : undefined,
        courseCode: typeof context.courseCode === "string" ? context.courseCode : undefined,
        courseTitle: typeof context.courseTitle === "string" ? context.courseTitle : undefined,
        institution:
          typeof context.institution === "string" ? context.institution : undefined,
        level: typeof context.level === "string" ? context.level : undefined,
        minGpaScale:
          typeof context.minGpaScale === "number" ? context.minGpaScale : undefined,
        minGpaValue:
          typeof context.minGpaValue === "number" ? context.minGpaValue : undefined,
        minWam: typeof context.minWam === "number" ? context.minWam : undefined,
        qualificationLevelRequirement:
          typeof context.qualificationLevelRequirement === "string"
            ? context.qualificationLevelRequirement
            : undefined,
      },
      evaluationSource,
      fileName,
      pipeline: "transcript_eligibility",
    },
    null,
    0,
  );
}

function stripUndefinedProperties(properties: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined),
  );
}

function buildAiCaptureFormData(options: {
  distinctId: string;
  aiInput: AiMessage[];
  aiOutputChoices: AiMessage[];
  properties: Record<string, unknown>;
}) {
  const form = new FormData();
  const timestamp = new Date().toISOString();
  const inlineProperties = stripUndefinedProperties({
    distinct_id: options.distinctId,
    ...options.properties,
  });

  form.append(
    "event",
    new Blob(
      [
        JSON.stringify({
          event: "$ai_generation",
          distinct_id: options.distinctId,
          timestamp,
        }),
      ],
      { type: "application/json" },
    ),
  );

  form.append(
    "event.properties",
    new Blob([JSON.stringify(inlineProperties)], { type: "application/json" }),
  );

  form.append(
    "event.properties.$ai_input",
    new Blob([JSON.stringify(options.aiInput)], { type: "application/json" }),
    "ai_input.json",
  );

  form.append(
    "event.properties.$ai_output_choices",
    new Blob([JSON.stringify(options.aiOutputChoices)], { type: "application/json" }),
    "ai_output_choices.json",
  );

  return form;
}

async function posthogFetch(
  host: string,
  path: string,
  init: RequestInit,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    await fetch(`${host}${path}`, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

interface CaptureEligibilityFeedbackOptions {
  courseCode?: string;
  courseTitle?: string;
  requirementId: string;
  requirementSourceText?: string;
  /**
   * Status the matcher / deterministic rules produced for this requirement.
   */
  originalStatus: "pass" | "fail" | "unknown";
  /**
   * Status the user (or admissions reviewer) believes is correct.
   */
  overrideStatus: "pass" | "fail" | "unknown";
  reason?: string;
  /** Durable machine reason behind the disputed automated status. */
  reasonCode?: string;
  modelId?: string;
  promptVersion?: string;
  rulesVersion?: string;
  schemaVersion?: string;
  serviceVersion?: string;
}

/**
 * Captures admissions / applicant feedback that a specific automated requirement check was wrong.
 *
 * Sent to PostHog as a standard event (not an $ai_generation event) so it can be paired with the
 * upstream $ai_generation captured by `captureTranscriptAiGeneration` via the shared trace context
 * downstream. The labelled examples accumulated here feed back into prompt / fixture tuning.
 *
 * Observability failures never block the calling request.
 */
export async function captureEligibilityFeedback(
  options: CaptureEligibilityFeedbackOptions,
) {
  const client = getPostHogServerClient();
  if (!client) {
    return;
  }

  const distinctId = buildDistinctId({
    courseCode: options.courseCode,
    institution: undefined,
    level: undefined,
  });

  try {
    await client.captureImmediate({
      distinctId,
      event: "eligibility_check_override",
      properties: {
        eligibility_pipeline: "transcript_eligibility_v1",
        eligibility_rules_version: options.rulesVersion ?? "unknown",
        eligibility_service_version: options.serviceVersion ?? "unknown",
        eligibility_model_id: options.modelId ?? null,
        eligibility_prompt_version: options.promptVersion ?? null,
        eligibility_schema_version: options.schemaVersion ?? null,
        course_code: options.courseCode ?? null,
        course_title: options.courseTitle ?? null,
        requirement_id: options.requirementId,
        requirement_source_text: options.requirementSourceText ?? null,
        original_status: options.originalStatus,
        override_status: options.overrideStatus,
        reason: options.reason ?? null,
        reason_code: options.reasonCode ?? null,
      },
    });
  } catch {
    // Observability must never block the calling request.
  }
}

export async function captureTranscriptAiGeneration(
  options: CaptureTranscriptAiGenerationOptions,
) {
  const apiKey = readApiKey();
  if (!apiKey) {
    return;
  }

  const host = normalizeHost(
    process.env.POSTHOG_HOST?.trim() || process.env.VITE_POSTHOG_HOST?.trim(),
  );
  const traceId = createTraceId();
  const distinctId = buildDistinctId(options.context);
  const aiInput: AiMessage[] = [
    {
      role: "user",
      content: summarizeInput(options.context, options.evaluationSource, options.fileName),
    },
  ];
  const aiOutputChoices: AiMessage[] = [
    {
      role: "assistant",
      content: summarizeOutput(options.output),
    },
  ];
  const requirements = summarizeRequirements(options.output);
  const hasFailCheck = requirements.some((check) => check.status === "fail");
  const hasUnknownCheck = requirements.some((check) => check.status === "unknown");
  const outcome =
    typeof options.output.outcome === "string" ? options.output.outcome : "insufficient_data";
  const pendingEvidence = Array.isArray(options.output.pendingEvidence)
    ? (options.output.pendingEvidence as Array<Record<string, unknown>>)
    : [];
  const unknownReasonCodes = requirements
    .filter((check) => check.status === "unknown")
    .map((check) => check.reasonCode)
    .filter((code): code is string => typeof code === "string");

  const eventProperties = stripUndefinedProperties({
    $ai_trace_id: traceId,
    $ai_model: options.model,
    $ai_provider: options.provider,
    $ai_lib: "applications-api",
    $ai_lib_version: "transcript-eligibility-v1",
    $ai_input_tokens: options.tokenUsage?.inputTokens,
    $ai_output_tokens: options.tokenUsage?.outputTokens,
    $ai_latency: Number((options.latencyMs / 1000).toFixed(3)),
    eligibility_outcome: outcome,
    eligibility_has_fail_check: hasFailCheck,
    eligibility_has_unknown_check: hasUnknownCheck,
    eligibility_manual_review_required:
      typeof options.output.manualReviewRequired === "boolean"
        ? options.output.manualReviewRequired
        : null,
    eligibility_requirement_count: requirements.length,
    eligibility_rules_version:
      typeof options.output.rulesVersion === "string" ? options.output.rulesVersion : "unknown",
    eligibility_service_version:
      typeof options.output.serviceVersion === "string"
        ? options.output.serviceVersion
        : "unknown",
    eligibility_model_id:
      typeof options.output.modelId === "string" ? options.output.modelId : options.model,
    eligibility_prompt_version:
      typeof options.output.promptVersion === "string" ? options.output.promptVersion : null,
    eligibility_schema_version:
      typeof options.output.schemaVersion === "string" ? options.output.schemaVersion : null,
    eligibility_confidence:
      typeof options.output.confidence === "number" ? options.output.confidence : null,
    eligibility_pending_evidence_count: pendingEvidence.length,
    eligibility_pending_evidence_sources: pendingEvidence
      .map((entry) => (typeof entry.evidenceSource === "string" ? entry.evidenceSource : "unknown"))
      .join(","),
    eligibility_unknown_reason_codes: unknownReasonCodes.join(","),
    eligibility_pipeline: "transcript_eligibility_v1",
    eligibility_source: options.evaluationSource,
  });

  try {
    await posthogFetch(
      host,
      "/i/v0/ai/",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: buildAiCaptureFormData({
          aiInput,
          aiOutputChoices,
          distinctId,
          properties: eventProperties,
        }),
      },
      3000,
    );
  } catch {
    // Observability must never block transcript evaluation responses.
  }
}
