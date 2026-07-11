import type { RequirementInstance } from "./requirements.js";
import type { TranscriptEligibilityRequestContext } from "./types.js";

export type { TranscriptEligibilityRequestContext };

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
      (candidate.weight !== "mandatory" &&
        candidate.weight !== "alternative" &&
        candidate.weight !== "conditional") ||
      !candidate.params ||
      typeof candidate.params !== "object"
    ) {
      continue;
    }
    out.push(candidate as unknown as RequirementInstance);
  }

  return out.length > 0 ? out : undefined;
}

function maybeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function trimString(value: unknown) {
  return typeof value === "string" ? value.trim() : undefined;
}

/**
 * Parses and whitelists transcript-eligibility request context JSON.
 * Used by the app proxy and must stay aligned with the client builder fields.
 */
export function parseTranscriptEligibilityContext(
  rawValue: unknown,
): TranscriptEligibilityRequestContext {
  if (typeof rawValue === "string") {
    if (!rawValue.trim()) {
      return {};
    }
    try {
      return parseTranscriptEligibilityContext(JSON.parse(rawValue) as unknown);
    } catch {
      return {};
    }
  }

  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return {};
  }

  const candidate = rawValue as Record<string, unknown>;

  return {
    completed: typeof candidate.completed === "boolean" ? candidate.completed : undefined,
    country: trimString(candidate.country),
    courseCode: trimString(candidate.courseCode),
    courseTitle: trimString(candidate.courseTitle),
    cvUploaded: typeof candidate.cvUploaded === "boolean" ? candidate.cvUploaded : undefined,
    employmentCount:
      typeof candidate.employmentCount === "number" && Number.isFinite(candidate.employmentCount)
        ? candidate.employmentCount
        : undefined,
    entryRequirementsText: trimString(candidate.entryRequirementsText),
    hasAhpraRegistration:
      typeof candidate.hasAhpraRegistration === "boolean"
        ? candidate.hasAhpraRegistration
        : undefined,
    institution: trimString(candidate.institution),
    languageTestsCount:
      typeof candidate.languageTestsCount === "number" ? candidate.languageTestsCount : undefined,
    level: trimString(candidate.level),
    minGpaScale: maybeNumber(candidate.minGpaScale),
    minGpaValue: maybeNumber(candidate.minGpaValue),
    minWam: maybeNumber(candidate.minWam),
    qualificationLevelRequirement: trimString(candidate.qualificationLevelRequirement),
    requirements: normalizeRequirements(candidate.requirements),
  };
}

/** Serialises context for multipart `context` field (browser + proxy). */
export function serializeTranscriptEligibilityContext(
  context: TranscriptEligibilityRequestContext,
): string {
  return JSON.stringify(context);
}
