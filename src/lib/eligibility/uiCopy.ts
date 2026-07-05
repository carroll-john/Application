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

export const programEvidenceAdvisoryCopy = [
  "Admissions makes the final decision after verification.",
] as const;

export const eligibilityFeedbackCopy = {
  trigger: "Doesn't match your documents?",
  prompt: "Suggest a correction",
  intro:
    "If any of these automated results don't reflect your official documents, select them below and add a note for each one. Admissions will review your feedback — this won't change your application automatically.",
  automatedResultLabel: "Automated result",
  selectRowsLegend: "Which results don't match your documents?",
  rowCommentLabel: "Your note (optional)",
  rowCommentPlaceholder:
    "Explain what your documents show for this requirement.",
  submit: "Send feedback",
  cancel: "Cancel",
  submitting: "Sending...",
  submitted: "Thanks — we've noted your feedback for admissions review.",
} as const;
