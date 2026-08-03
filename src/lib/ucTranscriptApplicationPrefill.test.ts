import { describe, expect, it } from "vitest";
import {
  initialApplicationData,
  type TertiaryQualification,
} from "./applicationData";
import type { TranscriptEligibilityAssessment } from "./eligibility/types";
import {
  applyUcTranscriptApplicationPrefill,
  getVisibleUcTertiaryQualifications,
} from "./ucTranscriptApplicationPrefill";

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
      { createId: () => "transcript-qualification" },
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

  it("replaces CV qualification suggestions with only the transcript-backed qualification", () => {
    const assessment = transcriptAssessment();
    assessment.extractedData.applicantDetails.institutionName = {
      normalizedValue: "Monash University",
    };
    assessment.extractedData.studyDetails.highestEducationLevel = {
      normalizedValue: "Bachelor",
    };
    assessment.extractedData.studyDetails.programName = {
      normalizedValue: "Bachelor of Arts and Bachelor of Laws",
    };

    const mbaFromCv = existingQualification({
      id: "cv-mba",
      institution: "University of Melbourne",
    });
    const bachelorFromCv = existingQualification({
      id: "cv-bachelor",
      institution: "Monash University",
      level: "Bachelor",
      courseName: "Bachelor of Arts and Bachelor of Laws",
    });
    const unrelatedSavedQualification = existingQualification({
      id: "saved-doctorate",
      institution: "Saved University",
      level: "Doctorate",
      courseName: "Doctor of Philosophy",
    });
    const application = {
      ...initialApplicationData,
      tertiaryQualifications: [
        mbaFromCv,
        bachelorFromCv,
        unrelatedSavedQualification,
      ],
    };

    const result = applyUcTranscriptApplicationPrefill(application, assessment, {
      cvQualificationsToReplace: [mbaFromCv, bachelorFromCv],
    });

    expect(result.tertiaryQualifications.map((qualification) => qualification.id)).toEqual([
      "cv-bachelor",
      "saved-doctorate",
    ]);
    expect(result.tertiaryQualifications[0]).toMatchObject({
      institution: "Monash University",
      courseName: "Bachelor of Arts and Bachelor of Laws",
      transcriptEligibility: assessment,
    });
  });

  it("removes a stale standalone law degree subsumed by an anonymised double degree", () => {
    const assessment = transcriptAssessment();
    assessment.extractedData.applicantDetails.fullName = {
      normalizedValue: "Pilot Participant",
    };
    assessment.extractedData.applicantDetails.institutionName = {
      normalizedValue: "Monash University, Australia",
    };
    delete assessment.extractedData.applicantDetails.countryOfInstitution;
    assessment.extractedData.studyDetails.highestEducationLevel = {
      normalizedValue: "Bachelor",
    };
    assessment.extractedData.studyDetails.programName = {
      normalizedValue: "Bachelor of Arts / Bachelor of Laws",
    };

    const doubleDegree = existingQualification({
      id: "transcript-double-degree",
      institution: "Monash University",
      level: "Bachelor",
      courseName: "Bachelor of Arts / Bachelor of Laws",
    });
    const staleLawDegree = existingQualification({
      id: "stale-cv-law-degree",
      institution: "Monash University",
      level: "",
      courseName: "Bachelor of Laws (LLB)",
      transcriptEligibility: assessment,
    });
    const unrelatedSavedQualification = existingQualification({
      id: "saved-doctorate",
      institution: "Saved University",
      level: "Doctorate",
      courseName: "Doctor of Philosophy",
    });

    const result = applyUcTranscriptApplicationPrefill(
      {
        ...initialApplicationData,
        tertiaryQualifications: [
          doubleDegree,
          staleLawDegree,
          unrelatedSavedQualification,
        ],
      },
      assessment,
    );

    expect(result.tertiaryQualifications.map((qualification) => qualification.id)).toEqual([
      "transcript-double-degree",
      "saved-doctorate",
    ]);
    expect(result.tertiaryQualifications[0]).toMatchObject({
      country: "Australia",
      institution: "Monash University",
      courseName: "Bachelor of Arts / Bachelor of Laws",
      transcriptEligibility: assessment,
    });
  });

  it("hides a stale standalone law degree in an existing anonymised pilot draft", () => {
    const assessment = transcriptAssessment();
    assessment.extractedData.applicantDetails.fullName = {
      normalizedValue: "Pilot Participant",
    };

    const doubleDegree = existingQualification({
      id: "transcript-double-degree",
      institution: "Monash University",
      level: "Bachelor",
      courseName: "Bachelor of Arts / Bachelor of Laws",
      transcriptEligibility: assessment,
    });
    const staleLawDegree = existingQualification({
      id: "stale-cv-law-degree",
      institution: "Monash University",
      level: "",
      courseName: "Bachelor of Laws (LLB)",
      transcriptEligibility: assessment,
    });
    const unrelatedSavedQualification = existingQualification({
      id: "saved-doctorate",
      institution: "Saved University",
      level: "Doctorate",
      courseName: "Doctor of Philosophy",
    });

    expect(
      getVisibleUcTertiaryQualifications([
        doubleDegree,
        staleLawDegree,
        unrelatedSavedQualification,
      ]).map((qualification) => qualification.id),
    ).toEqual(["transcript-double-degree", "saved-doctorate"]);
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
