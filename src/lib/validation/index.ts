import type { ApplicationData } from "../applicationData";
import {
  getEmploymentChronologyRules,
  getSection2RequirementRules,
  getTertiaryQualificationRules,
} from "./rules/section2";
import {
  getFamilySupportRules,
  section1ValidationRules,
} from "./rules/section1";
import {
  stepCompletionOrder,
  type StepCompletionLabel,
  type ValidationIssue,
  type ValidationRule,
  type ValidationTarget,
} from "./types";

function getValidationRules(data: ApplicationData): ValidationRule[] {
  return [
    ...section1ValidationRules,
    ...getFamilySupportRules(data),
    ...getSection2RequirementRules(data),
    ...getTertiaryQualificationRules(data),
    ...getEmploymentChronologyRules(data),
  ];
}

export function getValidationIssues(
  data: ApplicationData,
  target: ValidationTarget,
): ValidationIssue[] {
  return getValidationRules(data)
    .filter((rule) => rule.targets.includes(target))
    .filter((rule) => rule.isMissing(data, target))
    .map((rule) => ({
      field: rule.field,
      path: rule.path,
      section: rule.section,
      subsection: rule.subsection,
      stepLabel: rule.stepLabel,
    }));
}

export function getSubmissionValidationIssues(data: ApplicationData) {
  return getValidationIssues(data, "submissionReady");
}

export function isSubmissionReady(data: ApplicationData) {
  return getSubmissionValidationIssues(data).length === 0;
}

export function getNextIncompleteStep(
  data: ApplicationData,
): StepCompletionLabel | null {
  const missingStepLabels = new Set(
    getValidationIssues(data, "stepComplete")
      .map((issue) => issue.stepLabel)
      .filter((label): label is StepCompletionLabel => Boolean(label)),
  );

  return (
    stepCompletionOrder.find((stepLabel) => missingStepLabels.has(stepLabel)) ?? null
  );
}

export function getStepCompletionSummary(data: ApplicationData) {
  const missingStepLabels = new Set(
    getValidationIssues(data, "stepComplete")
      .map((issue) => issue.stepLabel)
      .filter((label): label is StepCompletionLabel => Boolean(label)),
  );
  const totalSteps = stepCompletionOrder.length;
  const completedSteps = totalSteps - missingStepLabels.size;

  return {
    completedSteps,
    completionPercentage:
      totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
    totalSteps,
  };
}

export type {
  StepCompletionLabel,
  ValidationIssue,
  ValidationTarget,
} from "./types";

export {
  getTertiaryQualificationSubmissionMissingFields,
  isEmploymentExperienceChronologyValid,
  isTertiaryQualificationSubmissionReady,
} from "./rules/section2";
