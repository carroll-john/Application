import { describe, expect, it } from "vitest";
import { initialApplicationData } from "../../lib/applicationData";
import {
  buildTertiaryTranscriptFlashMessage,
  needsHubTranscriptEligibilityProcessing,
  shouldAutoFillQualificationFromTranscript,
  shouldEvaluateTranscriptEligibility,
  shouldReplaceQualificationFromTranscript,
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
  it("applies draft whenever a transcript file is selected", () => {
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

  it("marks replacement when core fields already exist", () => {
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

    expect(shouldAutoFillQualificationFromTranscript(context)).toBe(true);
    expect(shouldReplaceQualificationFromTranscript(context)).toBe(true);
  });

  it("defers eligibility to the qualifications hub when a new transcript is selected", () => {
    expect(
      needsHubTranscriptEligibilityProcessing({
        selectedTranscriptFile: new File(["pdf"], "transcript.pdf", {
          type: "application/pdf",
        }),
        transcriptRemoved: false,
      }),
    ).toBe(true);
  });

  it("defers eligibility when a saved transcript has no assessment yet", () => {
    expect(
      needsHubTranscriptEligibilityProcessing({
        selectedTranscriptFile: null,
        transcriptDocument: {
          id: "doc-1",
          name: "transcript.pdf",
          size: 100,
          type: "application/pdf",
          lastModified: 1,
          uploadedAt: new Date().toISOString(),
        },
        transcriptRemoved: false,
      }),
    ).toBe(true);
  });

  it("skips hub eligibility when transcript is unchanged and already assessed", () => {
    expect(
      needsHubTranscriptEligibilityProcessing({
        selectedTranscriptFile: null,
        transcriptDocument: {
          id: "doc-1",
          name: "transcript.pdf",
          size: 100,
          type: "application/pdf",
          lastModified: 1,
          uploadedAt: new Date().toISOString(),
        },
        transcriptEligibility: {
          checkedAt: new Date().toISOString(),
          confidence: 0.9,
          extractedData: {},
          manualReviewRequired: false,
          missingInformation: [],
          outcome: "eligible",
          recommendedNextStep: "Proceed",
          requirementsChecked: [],
        },
        transcriptRemoved: false,
      }),
    ).toBe(false);
  });

  it("builds success flash when eligibility completes without new drafted fields", () => {
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
      draftedFieldCount: 0,
      preservedExistingFields: false,
      validationFailed: false,
    });

    expect(message?.type).toBe("success");
    expect(message?.message).toContain("saved a qualification drafted from your transcript");
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
