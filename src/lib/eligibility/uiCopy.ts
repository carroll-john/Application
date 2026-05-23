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

