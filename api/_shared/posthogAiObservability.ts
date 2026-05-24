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

const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";

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

function summarizeOutput(output: Record<string, unknown>) {
  const requirements = Array.isArray(output.requirementsChecked)
    ? output.requirementsChecked.map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const candidate = item as Record<string, unknown>;
        return {
          id: typeof candidate.id === "string" ? candidate.id : "unknown",
          status:
            candidate.status === "pass" ||
            candidate.status === "fail" ||
            candidate.status === "unknown"
              ? candidate.status
              : "unknown",
        };
      })
    : [];

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
      requirementsChecked: requirements.filter(Boolean),
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

  const payload = {
    api_key: apiKey,
    event: "$ai_generation",
    properties: {
      distinct_id: distinctId,
      $ai_trace_id: traceId,
      $ai_model: options.model,
      $ai_provider: options.provider,
      $ai_input: aiInput,
      $ai_output_choices: aiOutputChoices,
      $ai_input_tokens: options.tokenUsage?.inputTokens,
      $ai_output_tokens: options.tokenUsage?.outputTokens,
      $ai_latency: Number((options.latencyMs / 1000).toFixed(3)),
      eligibility_outcome:
        typeof options.output.outcome === "string" ? options.output.outcome : "insufficient_data",
      eligibility_rules_version:
        typeof options.output.rulesVersion === "string" ? options.output.rulesVersion : "unknown",
      eligibility_service_version:
        typeof options.output.serviceVersion === "string"
          ? options.output.serviceVersion
          : "unknown",
      eligibility_pipeline: "transcript_eligibility_v1",
      eligibility_source: options.evaluationSource,
    },
  };

  try {
    await fetch(`${host}/i/v0/e/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Observability must never block transcript evaluation responses.
  }
}
