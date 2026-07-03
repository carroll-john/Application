import { describe, expect, it } from "vitest";
import {
  eligibilityOutcomeCopy,
  eligibilityRequirementStatusCopy,
  programEvidenceAdvisoryCopy,
} from "./uiCopy";

describe("eligibility ui copy", () => {
  it("maps all outcome labels used in review surfaces", () => {
    expect(eligibilityOutcomeCopy).toEqual({
      eligible: "Eligible",
      conditionally_eligible: "Conditionally eligible",
      ineligible: "Ineligible",
      insufficient_data: "More information required",
    });
  });

  it("maps requirement status labels", () => {
    expect(eligibilityRequirementStatusCopy).toEqual({
      pass: "Pass",
      fail: "Fail",
      unknown: "Unknown",
    });
  });

  it("keeps supporting eligibility advisory copy split into paragraphs", () => {
    expect(programEvidenceAdvisoryCopy).toEqual([
      "Admissions makes the final decision after verification.",
    ]);
  });
});

