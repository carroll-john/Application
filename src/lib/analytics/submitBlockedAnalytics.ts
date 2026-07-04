import type { ApplicationData } from "../applicationData";
import type { ValidationIssue } from "../validation/types";
import { section1Steps } from "../section1Steps";
import { section2Steps } from "../section2Steps";
import { applicationStepDefinitions } from "./applicationSteps";
import type { AnalyticsEventName } from "./events";
import { capturePostHogEvent } from "./posthogClient";
import { getApplicationAnalyticsProperties } from "./posthogProperties";

export const APPLICATION_SUBMIT_BLOCKED_EVENT =
  "application_submit_blocked" satisfies AnalyticsEventName;

const stepLabelToAnalytics = new Map(
  [...section1Steps, ...section2Steps].map((step) => [
    step.analytics.stepLabel,
    {
      key: step.analytics.stepKey,
      label: step.analytics.stepLabel,
    },
  ]),
);

// Step-completion labels that differ from route analytics labels.
stepLabelToAnalytics.set("Tertiary qualifications", {
  key: "section2_qualifications",
  label: "Tertiary qualifications",
});

function getIssuePathname(path: string) {
  return path.split("?")[0] ?? path;
}

function getStepDefinitionForIssue(issue: ValidationIssue) {
  const pathname = getIssuePathname(issue.path);
  return (
    applicationStepDefinitions.find((step) => step.pattern.test(pathname)) ?? null
  );
}

function normalizeIssueCodePart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function resolveBlockedStepKey(issue: ValidationIssue) {
  if (issue.stepLabel) {
    return stepLabelToAnalytics.get(issue.stepLabel)?.key ?? null;
  }

  return getStepDefinitionForIssue(issue)?.key ?? null;
}

export function resolveBlockedStepLabel(issue: ValidationIssue) {
  if (issue.stepLabel) {
    return issue.stepLabel;
  }

  const stepDefinition = getStepDefinitionForIssue(issue);
  if (stepDefinition) {
    return stepDefinition.label;
  }

  return issue.subsection || null;
}

export function getValidationIssueCode(issue: ValidationIssue) {
  const stepKey = resolveBlockedStepKey(issue) ?? "unknown_step";
  return `${stepKey}:${normalizeIssueCodePart(issue.field)}`;
}

function getIssueStepOrder(issue: ValidationIssue) {
  return getStepDefinitionForIssue(issue)?.order ?? Number.MAX_SAFE_INTEGER;
}

function sortIssuesByBlockedStepOrder(issues: ValidationIssue[]) {
  return [...issues].sort((left, right) => {
    const orderDifference = getIssueStepOrder(left) - getIssueStepOrder(right);
    if (orderDifference !== 0) {
      return orderDifference;
    }

    return left.field.localeCompare(right.field);
  });
}

export function getSubmitBlockedValidationProperties(
  validationIssues: ValidationIssue[],
) {
  const orderedIssues = sortIssuesByBlockedStepOrder(validationIssues);
  const blockedStepKeys = [
    ...new Set(
      orderedIssues
        .map((issue) => resolveBlockedStepKey(issue))
        .filter((key): key is string => Boolean(key)),
    ),
  ];
  const blockedStepLabels = [
    ...new Set(
      orderedIssues
        .map((issue) => resolveBlockedStepLabel(issue))
        .filter((label): label is string => Boolean(label)),
    ),
  ];
  const fieldNames = [...new Set(orderedIssues.map((issue) => issue.field))];
  const validationIssueCodes = orderedIssues.map(getValidationIssueCode);
  const primaryIssue = orderedIssues[0] ?? null;

  return {
    application_step_key: primaryIssue
      ? resolveBlockedStepKey(primaryIssue)
      : null,
    application_step_label: primaryIssue
      ? resolveBlockedStepLabel(primaryIssue)
      : null,
    blocked_step_keys: blockedStepKeys,
    blocked_step_labels: blockedStepLabels,
    field_names: fieldNames,
    primary_field: primaryIssue?.field ?? null,
    submit_page_key: "review_and_submit",
    validation_error_count: validationIssues.length,
    validation_issue_codes: validationIssueCodes,
  };
}

export function trackApplicationSubmitBlocked({
  application,
  validationIssues,
}: {
  application: ApplicationData | null | undefined;
  validationIssues: ValidationIssue[];
}) {
  capturePostHogEvent(APPLICATION_SUBMIT_BLOCKED_EVENT, {
    ...getApplicationAnalyticsProperties(application),
    ...getSubmitBlockedValidationProperties(validationIssues),
    application_route_path: "/review",
    page_group: "application",
    page_key: "review_and_submit",
    page_name: "Review and submit",
  });
}
