import { describe, expect, it } from "vitest";
import { initialApplicationData } from "../../lib/applicationData";
import {
  buildTertiaryTranscriptFlashMessage,
  shouldAutoFillQualificationFromTranscript,
  shouldEvaluateTranscriptEligibility,
} from "./tertiaryTranscriptParsePolicy";

function emptyFormData() {
  return {
    id: "q1",
    institution: "",
    country: "Australia",
    level: "",
    courseName: "",
    startMonth: "",
    startYear: "",
    completed: true,
    endMonth: "",
    endYear: "",
  };
}

describe("tertiaryTranscriptParsePolicy", () => {
  it("auto-fills only when transcript is new and core fields are empty", () => {
    const context = {
      applicationData: initialApplicationData,
      formData: emptyFormData(),
      selectedTranscriptFile: new File(["pdf"], "transcript.pdf", {
        type: "application/pdf",
      }),
    };

    expect(shouldAutoFillQualificationFromTranscript(context)).toBe(true);
    expect(shouldEvaluateTranscriptEligibility(context)).toBe(true);
  });

  it("skips auto-fill when core fields already exist", () => {
    const context = {
      applicationData: initialApplicationData,
      formData: {
        ...emptyFormData(),
        institution: "Existing University",
      },
      selectedTranscriptFile: new File(["pdf"], "transcript.pdf", {
        type: "application/pdf",
      }),
    };

    expect(shouldAutoFillQualificationFromTranscript(context)).toBe(false);
    expect(shouldEvaluateTranscriptEligibility(context)).toBe(true);
  });

  it("builds combined success flash when fields were drafted", () => {
    const message = buildTertiaryTranscriptFlashMessage({
      assessment: {
        checkedAt: new Date().toISOString(),
        confidence: 0.9,
        extractedData: {},
        manualReviewRequired: false,
        missingInformation: [],
        outcome: "eligible",
        recommendedNextStep: "Proceed",
        requirementsChecked: [],
      },
      draftedFieldCount: 4,
      preservedExistingFields: false,
      validationFailed: false,
    });

    expect(message?.type).toBe("success");
    expect(message?.message).toContain("saved a qualification drafted from your transcript");
  });

  it("builds warning flash when validation still fails", () => {
    const message = buildTertiaryTranscriptFlashMessage({
      draftedFieldCount: 1,
      preservedExistingFields: false,
      validationFailed: true,
    });

    expect(message?.type).toBe("warning");
    expect(message?.message).toContain("some details still need your input");
  });
});
