import { consolidatePairedQualificationRequirements } from "./requirementPresentation.js";
import type { RequirementInstance } from "./requirements.js";

/** Pathway-first rules IR — expresses `(A AND B) OR (C AND D)` entry pathways. */
export interface CourseRequirementsPathway {
  id: string;
  label?: string;
  requirements: RequirementInstance[];
}

export interface CourseRequirementsV2 {
  version: 2;
  global: RequirementInstance[];
  pathways: CourseRequirementsPathway[];
}

export type CourseRequirementsEntry = RequirementInstance[] | CourseRequirementsV2;

export function isCourseRequirementsV2(value: unknown): value is CourseRequirementsV2 {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    candidate.version === 2 &&
    Array.isArray(candidate.global) &&
    Array.isArray(candidate.pathways)
  );
}

/**
 * Flattens v2 IR into the legacy `RequirementInstance[]` shape the matcher consumes.
 * Pathway-scoped requirements receive `pathwayBundleId`; global requirements do not.
 */
export function flattenCourseRequirementsV2(v2: CourseRequirementsV2): RequirementInstance[] {
  const global = v2.global.map((requirement) => ({ ...requirement }));
  const pathwayRequirements = v2.pathways.flatMap((pathway) =>
    pathway.requirements.map((requirement) => ({
      ...requirement,
      pathwayBundleId: requirement.pathwayBundleId ?? pathway.id,
    })),
  );
  return [...global, ...pathwayRequirements];
}

export function normalizeCourseRequirementsEntry(value: unknown): RequirementInstance[] {
  if (isCourseRequirementsV2(value)) {
    return flattenCourseRequirementsV2(value);
  }
  if (Array.isArray(value)) {
    return value as RequirementInstance[];
  }
  return [];
}

/**
 * Detects unsafe flat-list shapes (multiple mandatory pathways smashed into one AND list).
 * When requirements carry distinct `pathwayBundleId` values, each bucket is validated
 * independently so multi-pathway courses can route to the matcher safely.
 */
export function isMatcherUnsafe(requirements: readonly RequirementInstance[]): boolean {
  const pathwayIds = new Set(
    requirements
      .map((requirement) => requirement.pathwayBundleId)
      .filter((id): id is string => Boolean(id)),
  );

  if (pathwayIds.size >= 2) {
    const globalOnly = requirements.filter((requirement) => !requirement.pathwayBundleId);
    if (isSinglePathwayUnsafe(globalOnly)) {
      return true;
    }
    for (const pathwayId of pathwayIds) {
      const pathwayOnly = requirements.filter(
        (requirement) => requirement.pathwayBundleId === pathwayId,
      );
      if (isSinglePathwayUnsafe(pathwayOnly)) {
        return true;
      }
    }
    return false;
  }

  return isSinglePathwayUnsafe(requirements);
}

export function isSinglePathwayUnsafe(requirements: readonly RequirementInstance[]): boolean {
  if (requirements.length === 0) {
    return false;
  }

  let mandatoryQualificationCompleted = 0;
  let mandatoryFieldOfStudy = 0;
  const alternativeGroups = new Set<string>();

  for (const requirement of requirements) {
    if (requirement.weight === "alternative" && requirement.alternativeGroupId) {
      alternativeGroups.add(requirement.alternativeGroupId);
      continue;
    }
    const isMandatory = requirement.weight === "mandatory" && !requirement.alternativeGroupId;
    if (!isMandatory) {
      continue;
    }
    if (requirement.kind === "qualification_completed") {
      mandatoryQualificationCompleted += 1;
    }
    if (requirement.kind === "field_of_study") {
      mandatoryFieldOfStudy += 1;
    }
  }

  return (
    mandatoryQualificationCompleted > 1 ||
    mandatoryFieldOfStudy > 1 ||
    alternativeGroups.size > 1
  );
}

export interface CourseRequirementsValidationIssue {
  code: string;
  message: string;
}

export function validateCourseRequirementsV2(
  v2: CourseRequirementsV2,
): CourseRequirementsValidationIssue[] {
  const issues: CourseRequirementsValidationIssue[] = [];

  if (v2.pathways.length === 0 && v2.global.length === 0) {
    issues.push({
      code: "EMPTY",
      message: "Course requirements must include at least one global or pathway requirement.",
    });
  }

  for (const pathway of v2.pathways) {
    if (!pathway.id.trim()) {
      issues.push({ code: "PATHWAY_ID", message: "Every pathway must have a non-empty id." });
    }
    if (pathway.requirements.length === 0) {
      issues.push({
        code: "PATHWAY_EMPTY",
        message: `Pathway "${pathway.id}" has no requirements.`,
      });
    }
    if (isSinglePathwayUnsafe(pathway.requirements)) {
      issues.push({
        code: "PATHWAY_UNSAFE",
        message: `Pathway "${pathway.id}" contains an unsafe flat-list shape.`,
      });
    }
  }

  if (isSinglePathwayUnsafe(v2.global)) {
    issues.push({
      code: "GLOBAL_UNSAFE",
      message: "Global requirements contain an unsafe flat-list shape.",
    });
  }

  const flattened = flattenCourseRequirementsV2(v2);
  if (v2.pathways.length >= 2 && isMatcherUnsafe(flattened)) {
    issues.push({
      code: "FLATTEN_UNSAFE",
      message: "Flattened multi-pathway requirements are still matcher-unsafe.",
    });
  }

  return issues;
}

/** Removes paired qualification_completed duplicates and normalizes bachelor detail text. */
export function consolidateCourseRequirementsV2(v2: CourseRequirementsV2): CourseRequirementsV2 {
  return {
    ...v2,
    global: consolidatePairedQualificationRequirements(v2.global),
    pathways: v2.pathways.map((pathway) => ({
      ...pathway,
      requirements: consolidatePairedQualificationRequirements(pathway.requirements),
    })),
  };
}

/** Wraps a flat v1 list as a single default pathway for storage migration. */
export function wrapFlatRequirementsAsV2(
  requirements: readonly RequirementInstance[],
): CourseRequirementsV2 {
  return {
    version: 2,
    global: [],
    pathways: [
      {
        id: "default",
        requirements: requirements.map((requirement) => ({ ...requirement })),
      },
    ],
  };
}
