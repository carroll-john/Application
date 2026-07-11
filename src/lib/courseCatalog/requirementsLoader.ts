import generated from "./requirements.generated.json";
import type { RequirementInstance } from "../eligibility/requirements";
import {
  isCourseRequirementsV2,
  isMatcherUnsafe,
  normalizeCourseRequirementsEntry,
} from "../eligibility/courseRequirementsV2";

interface GeneratedRequirementsFile {
  version: number;
  generatedAt: string | null;
  model: string | null;
  /**
   * Map of course code -> RequirementInstance[] (v1) or CourseRequirementsV2 (v2).
   * The on-disk v1 form uses `null` for absent optional fields (OpenAI strict schemas).
   */
  courses: Record<string, unknown>;
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
  if (normalized.pathwayBundleId === null) {
    delete normalized.pathwayBundleId;
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

function normalizeRawCourseEntry(rawCourse: unknown): RequirementInstance[] {
  if (isCourseRequirementsV2(rawCourse)) {
    const normalizedV2 = {
      ...rawCourse,
      global: rawCourse.global.map(normalizeInstance),
      pathways: rawCourse.pathways.map((pathway) => ({
        ...pathway,
        requirements: pathway.requirements.map(normalizeInstance),
      })),
    };
    return normalizeCourseRequirementsEntry(normalizedV2);
  }

  if (!Array.isArray(rawCourse) || rawCourse.length === 0) {
    return [];
  }
  return rawCourse.map(normalizeInstance);
}

export function getRawGeneratedRequirementsEntry(courseCode: string): unknown {
  return typedGenerated.courses[courseCode];
}

export function getGeneratedRequirementsForCourse(
  courseCode: string,
): RequirementInstance[] | undefined {
  const entry = normalizeRawCourseEntry(typedGenerated.courses[courseCode]);
  if (entry.length === 0) {
    return undefined;
  }
  if (isMatcherUnsafe(entry)) {
    return undefined;
  }
  return entry;
}

export { isMatcherUnsafe } from "../eligibility/courseRequirementsV2";

export function getGeneratedRequirementsMetadata() {
  return {
    version: typedGenerated.version,
    generatedAt: typedGenerated.generatedAt,
    model: typedGenerated.model,
    courseCount: Object.keys(typedGenerated.courses).length,
  };
}
