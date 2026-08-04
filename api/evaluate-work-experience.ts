import {
  buildWorkExperienceAssessment,
  type WorkExperienceAssessment,
  type WorkExperienceRoleClassification,
  type WorkExperienceRoleInput,
  type RequirementInstance,
} from "@johncarroll/eligibility-rules";
import { callLlm } from "./_ai/callLlm.js";
import {
  resolveLlmModel,
  resolveLlmRuntimeConfig,
} from "./_ai/runtimeConfig.js";
import { workExperienceAssessmentPromptV1 } from "./_ai/prompts/workExperienceAssessment.v1.js";
import { workExperienceAssessmentSchemaV1 } from "./_ai/schemas/workExperienceAssessment.v1.js";
import {
  authenticateRequest,
  getClientIp,
  isDeployedEnvironment,
} from "./_documentParser/auth.js";
import { createRateLimiter } from "./_shared/rateLimiter.js";

const DEFAULT_MODEL = "gpt-4.1-mini";
const MAX_ROLES = 30;
const MAX_REQUIREMENTS = 12;
const MAX_TEXT_LENGTH = 5_000;
const PROMPT_VERSION = `${workExperienceAssessmentPromptV1.id}@v${workExperienceAssessmentPromptV1.version}`;

const rateLimiter = createRateLimiter({ max: 20, windowMs: 60_000 });

type WorkRequirement = Extract<RequirementInstance, { kind: "work_experience" }>;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function errorResponse(code: string, error: string, status: number) {
  return jsonResponse({ code, error }, status);
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, MAX_TEXT_LENGTH) : "";
}

function parseRole(value: unknown): WorkExperienceRoleInput | null {
  if (!value || typeof value !== "object") return null;
  const role = value as Record<string, unknown>;
  const id = cleanText(role.id);
  if (!id) return null;
  return {
    id,
    position: cleanText(role.position),
    duties: cleanText(role.duties),
    startMonth: cleanText(role.startMonth),
    startYear: cleanText(role.startYear),
    endMonth: cleanText(role.endMonth),
    endYear: cleanText(role.endYear),
    currentRole: role.currentRole === true,
  };
}

function parseRequirement(value: unknown): WorkRequirement | null {
  if (!value || typeof value !== "object") return null;
  const requirement = value as Record<string, unknown>;
  const params = requirement.params;
  if (
    requirement.kind !== "work_experience" ||
    typeof requirement.id !== "string" ||
    typeof requirement.sourceText !== "string" ||
    !params ||
    typeof params !== "object" ||
    typeof (params as Record<string, unknown>).minYears !== "number"
  ) {
    return null;
  }
  return requirement as unknown as WorkRequirement;
}

function fallbackAssessments(
  requirements: WorkRequirement[],
  roles: WorkExperienceRoleInput[],
  reason: string,
): WorkExperienceAssessment[] {
  return requirements.map((requirement) =>
    buildWorkExperienceAssessment({
      requirement,
      roles,
      classifications: [],
      promptVersion: PROMPT_VERSION,
      unassessedConditions: [reason],
    }),
  );
}

function readModelAssessments(value: unknown) {
  if (!value || typeof value !== "object") return [];
  const assessments = (value as { assessments?: unknown }).assessments;
  return Array.isArray(assessments) ? assessments : [];
}

export function normalizeWorkExperienceRoleClassification(
  value: unknown,
  role: WorkExperienceRoleInput,
  hasRoleCriteria: boolean,
): WorkExperienceRoleClassification {
  const candidate = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const relevanceValues = new Set(["relevant", "possibly_relevant", "not_demonstrated"]);
  const roleCriteriaValues = new Set(["met", "possibly_met", "not_demonstrated", "not_required"]);
  let relevanceStatus = relevanceValues.has(String(candidate.relevanceStatus))
    ? candidate.relevanceStatus as WorkExperienceRoleClassification["relevanceStatus"]
    : "not_demonstrated";
  let roleCriteriaStatus = hasRoleCriteria
    ? roleCriteriaValues.has(String(candidate.roleCriteriaStatus)) && candidate.roleCriteriaStatus !== "not_required"
      ? candidate.roleCriteriaStatus as WorkExperienceRoleClassification["roleCriteriaStatus"]
      : "not_demonstrated"
    : "not_required";

  const source = `${role.position}\n${role.duties}`.toLowerCase();
  const evidencePhrases = Array.isArray(candidate.evidencePhrases)
    ? candidate.evidencePhrases
        .filter((phrase): phrase is string =>
          typeof phrase === "string" && Boolean(phrase.trim()) && source.includes(phrase.trim().toLowerCase()),
        )
        .map((phrase) => phrase.trim())
        .slice(0, 6)
    : [];
  const dutiesSource = role.duties.toLowerCase();
  const hasDutiesEvidence = evidencePhrases.some((phrase) =>
    dutiesSource.includes(phrase.toLowerCase()),
  );
  // A title is a clue, not proof of relevance, duties, or authority. Definite matches
  // require at least one exact supporting phrase from the supplied duties.
  if (!hasDutiesEvidence) {
    if (relevanceStatus === "relevant") relevanceStatus = "possibly_relevant";
    if (roleCriteriaStatus === "met") roleCriteriaStatus = "possibly_met";
  }
  const confidence = typeof candidate.confidence === "number" && Number.isFinite(candidate.confidence)
    ? Math.max(0, Math.min(1, candidate.confidence))
    : 0;
  return {
    employmentExperienceId: role.id,
    relevanceStatus,
    roleCriteriaStatus,
    confidence,
    explanation: cleanText(candidate.explanation) || "This role could not be assessed automatically.",
    evidencePhrases,
  };
}

async function handleRequest(request: Request) {
  if (request.method !== "POST") {
    return errorResponse("WORK_EXPERIENCE_METHOD_NOT_ALLOWED", "Method not allowed.", 405);
  }

  const authResult = await authenticateRequest(request);
  if (authResult.kind === "open" && isDeployedEnvironment()) {
    return errorResponse(
      "WORK_EXPERIENCE_NOT_CONFIGURED",
      "Work-experience assessment is not configured on this deployment.",
      503,
    );
  }
  if (authResult.kind === "unauthenticated") {
    return errorResponse(
      "WORK_EXPERIENCE_UNAUTHORIZED",
      "Sign in before assessing work experience.",
      401,
    );
  }

  const key =
    authResult.kind === "authenticated"
      ? `user:${authResult.userId}`
      : `ip:${getClientIp(request) ?? "unknown"}`;
  if (rateLimiter.isLimited(key)) {
    return errorResponse(
      "WORK_EXPERIENCE_RATE_LIMITED",
      "Too many assessment requests. Please wait a moment.",
      429,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(
      "WORK_EXPERIENCE_REQUEST_INVALID",
      "The assessment request was not valid JSON.",
      400,
    );
  }
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const requirements = (Array.isArray(record.requirements) ? record.requirements : [])
    .slice(0, MAX_REQUIREMENTS)
    .map(parseRequirement)
    .filter((value): value is WorkRequirement => Boolean(value));
  const roles = (Array.isArray(record.roles) ? record.roles : [])
    .slice(0, MAX_ROLES)
    .map(parseRole)
    .filter((value): value is WorkExperienceRoleInput => Boolean(value));

  if (requirements.length === 0) {
    return errorResponse(
      "WORK_EXPERIENCE_REQUIREMENT_REQUIRED",
      "At least one work-experience requirement is required.",
      400,
    );
  }

  const llmConfig = resolveLlmRuntimeConfig();
  if (!llmConfig) {
    return jsonResponse({
      assessments: fallbackAssessments(requirements, roles, "Automatic assessment is unavailable."),
      source: "fallback",
    });
  }

  const model = resolveLlmModel(
    process.env.OPENAI_WORK_EXPERIENCE_MODEL?.trim() ||
      process.env.OPENAI_CV_PARSER_MODEL?.trim() ||
      DEFAULT_MODEL,
    llmConfig,
  );
  const modelInput = {
    requirements: requirements.map(({ id, params, sourceText }) => ({ id, params, sourceText })),
    roles: roles.map(({ id, position, duties }) => ({ id, position, duties })),
  };
  let result: Awaited<ReturnType<typeof callLlm>>;
  try {
    result = await callLlm({
      provider: "openai",
      apiKey: llmConfig.apiKey,
      responsesUrl: llmConfig.responsesUrl,
      model,
      prompt: workExperienceAssessmentPromptV1,
      schema: workExperienceAssessmentSchemaV1,
      attachments: [{ kind: "text", text: JSON.stringify(modelInput) }],
      initialMaxOutputTokens: 2_000,
      retryMaxOutputTokens: 6_000,
      trace: {
        enabled: false,
        agentName: "work-experience-assessor",
        recordInputs: false,
        recordOutputs: false,
      },
    });
  } catch {
    return jsonResponse({
      assessments: fallbackAssessments(requirements, roles, "Automatic assessment could not be completed."),
      source: "fallback",
    });
  }

  if (result.status !== "ok") {
    return jsonResponse({
      assessments: fallbackAssessments(requirements, roles, "Automatic assessment could not be completed."),
      source: "fallback",
    });
  }

  const modelAssessments = readModelAssessments(result.parsed);
  const assessments = requirements.map((requirement) => {
    const candidate = modelAssessments.find(
      (item) =>
        item &&
        typeof item === "object" &&
        (item as { requirementId?: unknown }).requirementId === requirement.id,
    ) as
      | { roleClassifications?: WorkExperienceRoleClassification[]; unassessedConditions?: string[] }
      | undefined;
    const rawClassifications = Array.isArray(candidate?.roleClassifications)
      ? candidate.roleClassifications
      : [];
    return buildWorkExperienceAssessment({
      requirement,
      roles,
      classifications: roles.map((role) =>
        normalizeWorkExperienceRoleClassification(
          rawClassifications.find((item) => item?.employmentExperienceId === role.id),
          role,
          Boolean(requirement.params.qualifyingRoleCriteria),
        ),
      ),
      unassessedConditions: Array.isArray(candidate?.unassessedConditions)
        ? candidate.unassessedConditions.filter((item): item is string => typeof item === "string")
        : ["Automatic assessment did not return this requirement."],
      modelId: model,
      promptVersion: PROMPT_VERSION,
    });
  });

  return jsonResponse({ assessments, source: "openai" });
}

export default { fetch: handleRequest };
