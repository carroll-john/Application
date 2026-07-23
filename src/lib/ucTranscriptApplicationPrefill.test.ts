import { describe, expect, it } from "vitest";
import {
  initialApplicationData,
  type TertiaryQualification,
} from "./applicationData";
import type { TranscriptEligibilityAssessment } from "./eligibility/types";
import { applyUcTranscriptApplicationPrefill } from "./ucTranscriptApplicationPrefill";

function transcriptAssessment(): TranscriptEligibilityAssessment {
  return {
    checkedAt: "2026-07-23T00:00:00.000Z",
    confidence: 0.96,
    extractedData: {
      applicantDetails: {
        countryOfInstitution: { normalizedValue: "Australia" },
        institutionName: { normalizedValue: "University of Melbourne" },
      },
      studyDetails: {
        completionDate: { normalizedValue: "November 2001" },
        completionStatus: { normalizedValue: "completed" },
        highestEducationLevel: { normalizedValue: "Masters" },
        programName: {
          normalizedValue: "Master of Business Administration",
        },
        startDate: { normalizedValue: "February 1999" },
      },
    },
    manualReviewRequired: false,
    missingInformation: [],
    outcome: "eligible",
    programCode: "UC-COURSE-A,UC-COURSE-B,UC-COURSE-C",
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
    level: "Masters",
    courseName: "Master of Business Administration (MBA)",
    startMonth: "",
    startYear: "",
    completed: true,
    endMonth: "",
    endYear: "",
    ...overrides,
  };
}

describe("applyUcTranscriptApplicationPrefill", () => {
  it("creates a prefilled qualification without carrying the transcript file", () => {
    const assessment = transcriptAssessment();
    const result = applyUcTranscriptApplicationPrefill(
      initialApplicationData,
      assessment,
      () => "transcript-qualification",
    );

    expect(result.tertiaryQualifications).toEqual([
      expect.objectContaining({
        id: "transcript-qualification",
        institution: "University of Melbourne",
        country: "Australia",
        level: "Masters",
        courseName: "Master of Business Administration",
        startMonth: "February",
        startYear: "1999",
        endMonth: "November",
        endYear: "2001",
        transcriptEligibility: assessment,
      }),
    ]);
    expect(result.tertiaryQualifications[0].transcriptDocument).toBeUndefined();
    expect(result.tertiaryQualifications[0].transcriptDocumentName).toBeUndefined();
  });

  it("fills only blank fields on the matching CV qualification", () => {
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
      courseName: "Master of Business Administration (MBA)",
      startMonth: "February",
      startYear: "1999",
      endMonth: "November",
      endYear: "2001",
    });
    expect(result.tertiaryQualifications[0].transcriptEligibility?.programCode).toBe(
      "UC-COURSE-A,UC-COURSE-B,UC-COURSE-C",
    );
  });

  it("preserves an existing course-specific transcript assessment", () => {
    const savedAssessment = {
      ...transcriptAssessment(),
      programCode: "SAVED-COURSE",
    };
    const application = {
      ...initialApplicationData,
      tertiaryQualifications: [
        existingQualification({ transcriptEligibility: savedAssessment }),
      ],
    };
    const result = applyUcTranscriptApplicationPrefill(
      application,
      transcriptAssessment(),
    );

    expect(result.tertiaryQualifications[0].transcriptEligibility).toBe(
      savedAssessment,
    );
  });

  it("leaves the application unchanged when no qualification fields were extracted", () => {
    const assessment = {
      ...transcriptAssessment(),
      extractedData: {},
    };

    expect(
      applyUcTranscriptApplicationPrefill(initialApplicationData, assessment),
    ).toBe(initialApplicationData);
  });
});
