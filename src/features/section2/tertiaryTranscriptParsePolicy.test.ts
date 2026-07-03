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

  it("builds a success flash for an insufficient_data outcome when fields were already drafted", () => {
    // Regression: the hub's cached-assessment path always reports draftedFieldCount as 0
    // (fields were drafted earlier, on the add-tertiary page), so an "insufficient_data"
    // eligibility outcome (e.g. WAM wasn't found) must not be read as "no qualification could
    // be drafted" when the record actually has institution/course/date fields filled in.
    const message = buildTertiaryTranscriptFlashMessage({
      assessment: {
        checkedAt: new Date().toISOString(),
        confidence: 0.4,
        extractedData: {},
        manualReviewRequired: false,
        missingInformation: ["Academic result (WAM/GPA) was not found."],
        outcome: "insufficient_data",
        recommendedNextStep: "Add a transcript with the academic result visible.",
        requirementsChecked: [],
      },
      draftedFieldCount: 0,
      preservedExistingFields: false,
      qualificationHasCoreData: true,
      validationFailed: false,
    });

    expect(message?.type).toBe("success");
    expect(message?.message).toContain("saved a qualification drafted from your transcript");
  });

  it("builds a warning flash for an insufficient_data outcome when no fields were drafted", () => {
    const message = buildTertiaryTranscriptFlashMessage({
      assessment: {
        checkedAt: new Date().toISOString(),
        confidence: 0.2,
        extractedData: {},
        manualReviewRequired: false,
        missingInformation: ["Could not read the transcript."],
        outcome: "insufficient_data",
        recommendedNextStep: "Try a clearer file.",
        requirementsChecked: [],
      },
      draftedFieldCount: 0,
      preservedExistingFields: false,
      qualificationHasCoreData: false,
      validationFailed: false,
    });

    expect(message?.type).toBe("warning");
    expect(message?.message).toContain("couldn't draft a qualification");
  });
});
