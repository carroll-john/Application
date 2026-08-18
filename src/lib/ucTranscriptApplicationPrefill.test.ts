import { describe, expect, it } from "vitest";
import {
  initialApplicationData,
  type TertiaryQualification,
} from "./applicationData";
import type { TranscriptEligibilityAssessment } from "./eligibility/types";
import { applyUcTranscriptApplicationPrefill } from "./ucTranscriptApplicationPrefill";

function transcriptAssessment(): TranscriptEligibilityAssessment {
  return {
    checkedAt: "2026-08-19T00:00:00.000Z",
    confidence: 0.96,
    extractedData: {
      applicantDetails: {
        countryOfInstitution: { normalizedValue: "Australia" },
        institutionName: { normalizedValue: "RMIT University" },
      },
      studyDetails: {
        completionStatus: {
          normalizedValue: "not_completed",
          originalValue: "Course discontinued - no award conferred",
        },
        highestEducationLevel: { normalizedValue: "Bachelor" },
        programName: { normalizedValue: "Bachelor of Business (Management)" },
        startDate: { normalizedValue: "26 February 2024" },
        studyEndDate: { normalizedValue: "2025-08-29" },
      },
    },
    manualReviewRequired: false,
    missingInformation: [],
    outcome: "eligible",
    programCode: "MGM104,MGC103,ARC701",
    recommendedNextStep: "Continue",
    requirementsChecked: [],
  };
}

function existingQualification(
  overrides: Partial<TertiaryQualification> = {},
): TertiaryQualification {
  return {
    id: "existing-qualification",
    institution: "Saved University",
    country: "Australia",
    level: "Bachelor",
    courseName: "Bachelor of Business (Management)",
    startMonth: "",
    startYear: "",
    completed: false,
    endMonth: "",
    endYear: "",
    ...overrides,
  };
}

describe("applyUcTranscriptApplicationPrefill", () => {
  it("creates Maya's incomplete transcript-backed qualification", () => {
    const assessment = transcriptAssessment();
    const result = applyUcTranscriptApplicationPrefill(
      initialApplicationData,
      assessment,
      { createId: () => "transcript-qualification" },
    );

    expect(result.tertiaryQualifications).toEqual([
      expect.objectContaining({
        id: "transcript-qualification",
        institution: "RMIT University",
        country: "Australia",
        level: "Bachelor",
        courseName: "Bachelor of Business (Management)",
        startMonth: "February",
        startYear: "2024",
        completed: false,
        endMonth: "August",
        endYear: "2025",
        transcriptEligibility: assessment,
      }),
    ]);
  });

  it("fills blank fields without overwriting saved qualification details", () => {
    const application = {
      ...initialApplicationData,
      tertiaryQualifications: [existingQualification()],
    };
    const result = applyUcTranscriptApplicationPrefill(
      application,
      transcriptAssessment(),
    );

    expect(result.tertiaryQualifications).toHaveLength(1);
    expect(result.tertiaryQualifications[0]).toMatchObject({
      id: "existing-qualification",
      institution: "Saved University",
      startMonth: "February",
      startYear: "2024",
      completed: false,
      endMonth: "August",
      endYear: "2025",
    });
  });

  it("keeps unrelated saved qualifications when replacing CV suggestions", () => {
    const cvSuggestion = existingQualification({ id: "cv-bachelor" });
    const savedQualification = existingQualification({
      id: "saved-doctorate",
      institution: "Saved University",
      level: "PhD",
      courseName: "Doctor of Philosophy",
      completed: true,
    });
    const application = {
      ...initialApplicationData,
      tertiaryQualifications: [cvSuggestion, savedQualification],
    };

    const result = applyUcTranscriptApplicationPrefill(
      application,
      transcriptAssessment(),
      { cvQualificationsToReplace: [cvSuggestion] },
    );

    expect(result.tertiaryQualifications.map((qualification) => qualification.id)).toEqual([
      "cv-bachelor",
      "saved-doctorate",
    ]);
    expect(result.tertiaryQualifications[0].transcriptEligibility).toBeDefined();
  });

  it("leaves the application unchanged when no study fields were extracted", () => {
    const assessment = {
      ...transcriptAssessment(),
      extractedData: {},
    };

    expect(
      applyUcTranscriptApplicationPrefill(initialApplicationData, assessment),
    ).toBe(initialApplicationData);
  });
});
