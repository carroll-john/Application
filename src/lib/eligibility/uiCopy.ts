import type { EligibilityOutcome, EligibilityRequirementStatus } from "./types";

export const eligibilityOutcomeCopy: Record<EligibilityOutcome, string> = {
  eligible: "Eligible",
  conditionally_eligible: "Conditionally eligible",
  ineligible: "Ineligible",
  insufficient_data: "More information required",
};

export const eligibilityRequirementStatusCopy: Record<
  EligibilityRequirementStatus,
  string
> = {
  fail: "Fail",
  pass: "Pass",
  unknown: "Unknown",
};

export const eligibilityAdvisoryCopy =
  "Automated eligibility checks are advisory only. Final admissions decisions are made by the admissions team after official transcript verification.";

export const programEvidenceAdvisoryCopy =
  "These requirements still need documents or details. Admissions makes the final decision after verification.";

export const eligibilityFeedbackCopy = {
  trigger: "Doesn't match your transcript?",
  prompt: "Suggest a correction",
  intro:
    "If this automated result doesn't reflect your official transcript, tell us what it should say. Admissions will review your note — this won't change your application automatically.",
  automatedResultLabel: "Automated result",
  suggestedStatusLegend: "What should this be?",
  reasonLabel: "Add details (optional)",
  reasonPlaceholder:
    "For example, conferral date, qualification title, or grades not visible on this transcript.",
  submit: "Send feedback",
  cancel: "Cancel",
  submitting: "Sending...",
  submitted: "Thanks — we've noted your feedback for admissions review.",
} as const;

export const eligibilityFeedbackStatusLabels: Record<
  EligibilityRequirementStatus,
  string
> = {
  pass: "Met",
  fail: "Not met",
  unknown: "Unclear / needs review",
};
