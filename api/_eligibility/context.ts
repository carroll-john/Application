import type { RequirementInstance } from "../../src/lib/eligibility/requirements.js";

/** Request-context parsing for the transcript-eligibility route. */

export type TranscriptEligibilityRequestContext = {
  completed?: boolean;
  country?: string;
  courseCode?: string;
  courseTitle?: string;
  cvUploaded?: boolean;
  employmentCount?: number;
  entryRequirementsText?: string;
  hasAhpraRegistration?: boolean;
  institution?: string;
  languageTestsCount?: number;
  level?: string;
  minGpaScale?: number;
  minGpaValue?: number;
  minWam?: number;
  qualificationLevelRequirement?: string;
  requirements?: RequirementInstance[];
};

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

export function parseContext(
  rawValue: FormDataEntryValue | null,
): TranscriptEligibilityRequestContext {
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
      cvUploaded: typeof candidate.cvUploaded === "boolean" ? candidate.cvUploaded : undefined,
      employmentCount:
        typeof candidate.employmentCount === "number" && Number.isFinite(candidate.employmentCount)
          ? candidate.employmentCount
          : undefined,
      entryRequirementsText:
        typeof candidate.entryRequirementsText === "string"
          ? candidate.entryRequirementsText.trim()
          : undefined,
      hasAhpraRegistration:
        typeof candidate.hasAhpraRegistration === "boolean"
          ? candidate.hasAhpraRegistration
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
