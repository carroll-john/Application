import type { RequirementInstance } from "./requirements";
import {
  formatAcademicThreshold,
  formatQualificationLevel,
  type QualificationLevel,
} from "./requirements";

export const BACHELOR_QUALIFICATION_DETAIL_TEXT =
  "Completion of a 3-year Australian bachelor's degree or recognised equivalent";

type QualificationLevelRequirement = Extract<
  RequirementInstance,
  { kind: "qualification_level" }
>;

export function findPairedQualificationLevel(
  requirements: readonly RequirementInstance[],
  instance: RequirementInstance,
): QualificationLevelRequirement | undefined {
  if (instance.kind !== "qualification_completed" || instance.alternativeGroupId) {
    return undefined;
  }

  const match = requirements.find(
    (candidate) =>
      candidate.kind === "qualification_level" &&
      !candidate.alternativeGroupId &&
      candidate.weight === instance.weight &&
      candidate.sourceText === instance.sourceText,
  );
  return match?.kind === "qualification_level" ? match : undefined;
}

export function findPairedQualificationCompleted(
  requirements: readonly RequirementInstance[],
  instance: RequirementInstance,
): RequirementInstance | undefined {
  if (instance.kind !== "qualification_level" || instance.alternativeGroupId) {
    return undefined;
  }

  return requirements.find(
    (candidate) =>
      candidate.kind === "qualification_completed" &&
      !candidate.alternativeGroupId &&
      candidate.weight === instance.weight &&
      candidate.sourceText === instance.sourceText,
  );
}

export function shouldOmitPairedQualificationCompleted(
  requirements: readonly RequirementInstance[],
  instance: RequirementInstance,
): boolean {
  return (
    instance.kind === "qualification_completed" &&
    findPairedQualificationLevel(requirements, instance) !== undefined
  );
}

export function formatBachelorQualificationDetailText(sourceText: string): string {
  if (/bachelor/i.test(sourceText)) {
    return BACHELOR_QUALIFICATION_DETAIL_TEXT;
  }
  return sourceText;
}

function countSharedSourceText(
  siblings: readonly RequirementInstance[],
  sourceText: string,
): number {
  return siblings.filter((requirement) => requirement.sourceText === sourceText).length;
}

/**
 * Human-readable detail line for a requirement card or review quote block.
 * When multiple requirements share one published sentence, derive a short line from
 * structured params instead of repeating the full compound clause.
 */
export function formatRequirementDetailText(
  instance: RequirementInstance,
  siblings: readonly RequirementInstance[],
): string {
  if (instance.kind === "qualification_level" && instance.params.level === "bachelor") {
    const hasPairedCompleted = findPairedQualificationCompleted(siblings, instance) !== undefined;
    if (hasPairedCompleted || countSharedSourceText(siblings, instance.sourceText) <= 1) {
      return formatBachelorQualificationDetailText(instance.sourceText);
    }
  }

  if (countSharedSourceText(siblings, instance.sourceText) <= 1) {
    return instance.sourceText;
  }

  switch (instance.kind) {
    case "qualification_level":
      return instance.params.level === "bachelor"
        ? "An Australian bachelor degree or equivalent qualification"
        : formatQualificationLevel(instance.params.level);
    case "academic_threshold":
      if (instance.params.metric === "wam" && instance.params.min === 60) {
        return "At least a credit (60%) average, or equivalent Grade Point Average (GPA)";
      }
      return `Minimum ${formatAcademicThreshold(instance.params)}`;
    case "work_experience":
      return `At least ${instance.params.minYears} year(s) relevant experience${
        instance.params.relevantTo ? ` in a ${instance.params.relevantTo}` : ""
      }`;
    case "qualification_completed":
      return instance.sourceText.replace(/^Entry Level \d+:\s*/i, "");
    default:
      return instance.sourceText;
  }
}

export function formatMergedQualificationHeading(level: QualificationLevel): string {
  return formatQualificationLevel(level);
}

/**
 * Drops redundant `qualification_completed` leaves that duplicate a sibling
 * `qualification_level` requirement from the same published sentence.
 */
export function consolidatePairedQualificationRequirements(
  requirements: readonly RequirementInstance[],
): RequirementInstance[] {
  return requirements
    .filter((instance) => !shouldOmitPairedQualificationCompleted(requirements, instance))
    .map((instance) => {
      if (instance.kind !== "qualification_level" || instance.params.level !== "bachelor") {
        return instance;
      }
      if (!findPairedQualificationCompleted(requirements, instance)) {
        return instance;
      }
      return {
        ...instance,
        params: {
          ...instance.params,
          completedRequired: true,
        },
        sourceText: formatBachelorQualificationDetailText(instance.sourceText),
      };
    });
}
