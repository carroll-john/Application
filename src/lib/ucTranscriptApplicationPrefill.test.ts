import { describe, expect, it } from "vitest";
import {
  initialApplicationData,
  type TertiaryQualification,
} from "./applicationData";
import type { TranscriptEligibilityAssessment } from "./eligibility/types";
import {
  applyUcTranscriptApplicationPrefill,
  prefillStoredUcTranscriptQualification,
} from "./ucTranscriptApplicationPrefill";

function transcriptAssessment(): TranscriptEligibilityAssessment {
  return {
    checkedAt: "2026-08-19T00:00:00.000Z",
    confidence: 0.96,
    extractedData: {
      applicantDetails: {
        countryOfInstitution: { normalizedValue: "Australia" },
        fullName: { normalizedValue: "Maya Patel" },
        institutionName: { normalizedValue: "RMIT University" },
        studentId: { normalizedValue: "2024-1173" },
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

describe("prefillStoredUcTranscriptQualification", () => {
  it("repairs Maya's blank end date in an existing transcript-backed draft", () => {
    const assessment = transcriptAssessment();
    const result = prefillStoredUcTranscriptQualification(
      existingQualification({
        institution: "RMIT University",
        transcriptEligibility: {
          ...assessment,
          extractedData: {
            ...assessment.extractedData,
            studyDetails: {
              ...assessment.extractedData.studyDetails,
              studyEndDate: undefined,
            },
          },
        },
      }),
    );

    expect(result).toMatchObject({
      completed: false,
      endMonth: "August",
      endYear: "2025",
      startMonth: "February",
      startYear: "2024",
    });
  });

  it("does not replace an end date already saved by the applicant", () => {
    const result = prefillStoredUcTranscriptQualification(
      existingQualification({
        endMonth: "July",
        endYear: "2025",
        transcriptEligibility: transcriptAssessment(),
      }),
    );

    expect(result.endMonth).toBe("July");
    expect(result.endYear).toBe("2025");
  });
});
