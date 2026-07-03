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
  trigger: "Doesn't match your transcript?",
  prompt: "Suggest a correction",
  intro:
    "If any of these automated results don't reflect your official transcript, select them below and tell us what's wrong. Admissions will review your note — this won't change your application automatically.",
  automatedResultLabel: "Automated result",
  selectRowsLegend: "Which results don't match your transcript?",
  reasonLabel: "Add details (optional)",
  reasonPlaceholder:
    "For example, conferral date, qualification title, or grades not visible on this transcript.",
  submit: "Send feedback",
  cancel: "Cancel",
  submitting: "Sending...",
  submitted: "Thanks — we've noted your feedback for admissions review.",
} as const;
