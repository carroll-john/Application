import { describe, expect, it } from "vitest";
import { applyUcDemoTranscriptFixture } from "./ucDemoTranscriptFixtures";

function mayaAssessment(overrides: Record<string, unknown> = {}) {
  return {
    applicantDetails: {
      fullName: { normalizedValue: "Maya Patel" },
      institutionName: { normalizedValue: "RMIT University" },
      studentId: { normalizedValue: "2024-1173" },
    },
    studyDetails: {
      completionStatus: {
        normalizedValue: "withdrawn",
        originalValue: "Discontinued - no award conferred",
      },
      programName: {
        normalizedValue: "Bachelor of Business (Management)",
      },
    },
    ...overrides,
  };
}

describe("applyUcDemoTranscriptFixture", () => {
  it("restores Maya's labelled discontinuation date when extraction omits it", () => {
    const result = applyUcDemoTranscriptFixture(mayaAssessment());

    expect(result.studyDetails).toMatchObject({
      studyEndDate: {
        confidence: 1,
        missingOrAmbiguous: false,
        normalizedValue: "2025-08-29",
        originalValue: "29 August 2025",
      },
    });
  });

  it("supports an external-service payload with nested extracted data", () => {
    const result = applyUcDemoTranscriptFixture({
      extractedData: mayaAssessment(),
      outcome: "eligible",
    });

    expect(result.extractedData).toMatchObject({
      studyDetails: {
        studyEndDate: { normalizedValue: "2025-08-29" },
      },
    });
    expect(result.outcome).toBe("eligible");
  });

  it("recognises the fixture when one identity field is omitted", () => {
    const assessment = mayaAssessment({
      applicantDetails: {
        fullName: { normalizedValue: "Maya Patel" },
        institutionName: { normalizedValue: "RMIT University" },
      },
    });

    expect(applyUcDemoTranscriptFixture(assessment).studyDetails).toMatchObject({
      studyEndDate: { normalizedValue: "2025-08-29" },
    });
  });

  it("does not overwrite a date returned by the extractor", () => {
    const assessment = mayaAssessment({
      studyDetails: {
        ...mayaAssessment().studyDetails,
        studyEndDate: { normalizedValue: "2025-08-30" },
      },
    });

    expect(applyUcDemoTranscriptFixture(assessment)).toBe(assessment);
  });

  it("leaves another applicant's transcript untouched", () => {
    const assessment = mayaAssessment({
      applicantDetails: {
        fullName: { normalizedValue: "Another Student" },
        institutionName: { normalizedValue: "RMIT University" },
        studentId: { normalizedValue: "2024-1173" },
      },
    });

    expect(applyUcDemoTranscriptFixture(assessment)).toBe(assessment);
  });
});
