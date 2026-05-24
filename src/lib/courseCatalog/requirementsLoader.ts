import generated from "./requirements.generated.json";
import type { RequirementInstance } from "../eligibility/requirements";

interface GeneratedRequirementsFile {
  version: number;
  generatedAt: string | null;
  model: string | null;
  /**
   * Map of course code -> RequirementInstance[]. Empty when the parser script has not been run for
   * a given course. The on-disk form uses `null` for absent `alternativeGroupId` (OpenAI strict
   * schemas require every property; nulls cannot be omitted). We normalize to `undefined` on read
   * so the in-memory shape matches the TypeScript discriminated union.
   */
  courses: Record<string, unknown[]>;
}

const typedGenerated = generated as GeneratedRequirementsFile;

/**
 * Normalizes the on-disk JSON shape (which uses `null` for absent optional fields) into the typed
 * `RequirementInstance` shape (which uses `undefined`).
 */
function normalizeInstance(value: unknown): RequirementInstance {
  const raw = value as Record<string, unknown>;
  const normalized: Record<string, unknown> = { ...raw };
  if (normalized.alternativeGroupId === null) {
    delete normalized.alternativeGroupId;
  }
  const params = normalized.params;
  if (params && typeof params === "object") {
    const paramsRecord = { ...(params as Record<string, unknown>) };
    for (const key of Object.keys(paramsRecord)) {
      if (paramsRecord[key] === null) {
        delete paramsRecord[key];
      }
    }
    normalized.params = paramsRecord;
  }
  return normalized as unknown as RequirementInstance;
}

function normalizeCourse(rawCourse: unknown[] | undefined): RequirementInstance[] {
  if (!Array.isArray(rawCourse) || rawCourse.length === 0) {
    return [];
  }
  return rawCourse.map(normalizeInstance);
}

/**
 * Detects parser output shapes that indicate multiple alternative entry pathways were flattened into
 * a single mandatory list. Our schema is flat (single AND of requirements with optional OR-groups);
 * it cannot express `(A AND B) OR (C AND D)` pathway nesting. When the LLM smashes a multi-pathway
 * course flat, every applicant fails the requirements of pathways they did not take. We detect that
 * shape and refuse to expose the canonical requirements for that course — the runtime then falls
 * back to the legacy deterministic rules.
 */
export function isMatcherUnsafe(requirements: RequirementInstance[]): boolean {
  let mandatoryQualificationCompleted = 0;
  let mandatoryFieldOfStudy = 0;
  const alternativeGroups = new Set<string>();
  for (const requirement of requirements) {
    if (requirement.weight === "alternative" && requirement.alternativeGroupId) {
      alternativeGroups.add(requirement.alternativeGroupId);
      continue;
    }
    const isMandatory = requirement.weight === "mandatory" && !requirement.alternativeGroupId;
    if (!isMandatory) continue;
    if (requirement.kind === "qualification_completed") {
      mandatoryQualificationCompleted += 1;
    }
    if (requirement.kind === "field_of_study") {
      mandatoryFieldOfStudy += 1;
    }
  }
  // Multi-pathway courses are unsafe because our flat schema cannot express `(A AND B) OR (C AND D)`.
  // We treat any of the following as signals that the LLM flattened multiple pathways:
  // - Two or more mandatory qualification_completed entries with no OR group.
  // - Two or more mandatory field_of_study entries with no alternatives.
  // - Two or more distinct alternativeGroupIds — each "pathway" lifted into its own OR-group means
  //   the matcher will treat ANY member of either group as sufficient, which is over-permissive.
  return (
    mandatoryQualificationCompleted > 1 ||
    mandatoryFieldOfStudy > 1 ||
    alternativeGroups.size > 1
  );
}

export function getGeneratedRequirementsForCourse(
  courseCode: string,
): RequirementInstance[] | undefined {
  const entry = normalizeCourse(typedGenerated.courses[courseCode]);
  if (entry.length === 0) {
    return undefined;
  }
  if (isMatcherUnsafe(entry)) {
    return undefined;
  }
  return entry;
}

export function getGeneratedRequirementsMetadata() {
  return {
    version: typedGenerated.version,
    generatedAt: typedGenerated.generatedAt,
    model: typedGenerated.model,
    courseCount: Object.keys(typedGenerated.courses).length,
  };
}
