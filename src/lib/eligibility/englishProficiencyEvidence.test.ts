import { describe, expect, it } from "vitest";
import {
  initialApplicationData,
  type ApplicationData,
  type ProfessionalAccreditation,
  type TertiaryQualification,
} from "../applicationData";
import type { CourseCatalogEntry } from "../courseCatalog";
import type { TranscriptEligibilityAssessment } from "./types";
import {
  courseRequiresEnglishProficiency,
  hasAhpraRegistration,
  hasEnglishProficiencyEvidence,
  isAhpraRegistration,
  isEnglishInferableFromTranscripts,
  needsCertificateOfCompletion,
  needsEnglishProficiencyEvidence,
  transcriptConfirmsCompletion,
} from "./englishProficiencyEvidence";

function completionAssessment(
  completionStatus: string,
): TranscriptEligibilityAssessment {
  return {
    checkedAt: new Date().toISOString(),
    confidence: 0.9,
    extractedData: {
      studyDetails: {
        completionStatus: { confidence: 0.9, normalizedValue: completionStatus },
      },
    },
    manualReviewRequired: false,
    missingInformation: [],
    outcome: "eligible",
    recommendedNextStep: "",
    requirementsChecked: [],
  };
}

function tertiary(
  overrides: Partial<TertiaryQualification> = {},
): TertiaryQualification {
  return {
    id: "t1",
    institution: "Universitas Indonesia",
    country: "Indonesia",
    level: "Bachelor",
    courseName: "Bachelor of Engineering",
    startMonth: "January",
    startYear: "2014",
    completed: true,
    endMonth: "December",
    endYear: "2017",
    ...overrides,
  };
}

function accreditation(name: string): ProfessionalAccreditation {
  return { id: "a1", name, status: "Active" };
}

function application(overrides: Partial<ApplicationData> = {}): ApplicationData {
  return { ...initialApplicationData, ...overrides };
}

const englishCourse = {
  requirements: [
    {
      id: "eng",
      sourceText: "English language requirements: IELTS 6.5.",
      weight: "mandatory",
      kind: "english_proficiency",
      params: { acceptedPathways: [] },
    },
  ],
} as unknown as CourseCatalogEntry;

const noEnglishCourse = {
  requirements: [
    { id: "lvl", sourceText: "Bachelor degree.", weight: "mandatory", kind: "qualification_level", params: { level: "bachelor" } },
  ],
} as unknown as CourseCatalogEntry;

describe("isAhpraRegistration", () => {
  it("recognises explicit AHPRA mentions and registered health titles", () => {
    expect(isAhpraRegistration("AHPRA registration")).toBe(true);
    expect(isAhpraRegistration("Registered Nurse (AHPRA)")).toBe(true);
    expect(isAhpraRegistration("Registered Midwife")).toBe(true);
    expect(isAhpraRegistration("Medical Board of Australia")).toBe(true);
  });

  it("does not match unrelated accreditations", () => {
    expect(isAhpraRegistration("CPA Australia")).toBe(false);
    expect(isAhpraRegistration("Project Management Professional")).toBe(false);
    expect(isAhpraRegistration(undefined)).toBe(false);
  });
});

describe("hasAhpraRegistration", () => {
  it("is true only when an accreditation reads as an AHPRA registration", () => {
    expect(hasAhpraRegistration([accreditation("Registered Nurse")])).toBe(true);
    expect(hasAhpraRegistration([accreditation("CPA Australia")])).toBe(false);
    expect(hasAhpraRegistration([])).toBe(false);
  });
});

describe("transcriptConfirmsCompletion", () => {
  it("is true when the parsed transcript states completion", () => {
    expect(transcriptConfirmsCompletion(tertiary({ transcriptEligibility: completionAssessment("Completed") }))).toBe(true);
    expect(transcriptConfirmsCompletion(tertiary({ transcriptEligibility: completionAssessment("Award conferred") }))).toBe(true);
  });

  it("is false when the transcript doesn't state completion or there's no assessment", () => {
    expect(transcriptConfirmsCompletion(tertiary({ transcriptEligibility: completionAssessment("Discontinued") }))).toBe(false);
    expect(transcriptConfirmsCompletion(tertiary({ transcriptEligibility: completionAssessment("In progress") }))).toBe(false);
    expect(transcriptConfirmsCompletion(tertiary())).toBe(false);
  });

  it("falls back to the persisted snapshot when no in-memory assessment exists", () => {
    // A reloaded draft loses transcriptEligibility but keeps the persisted boolean.
    expect(transcriptConfirmsCompletion(tertiary({ transcriptCompletionConfirmed: true }))).toBe(true);
    expect(transcriptConfirmsCompletion(tertiary({ transcriptCompletionConfirmed: false }))).toBe(false);
    // A fresh in-memory assessment takes precedence over a stale persisted snapshot.
    expect(
      transcriptConfirmsCompletion(
        tertiary({
          transcriptCompletionConfirmed: true,
          transcriptEligibility: completionAssessment("Discontinued"),
        }),
      ),
    ).toBe(false);
  });
});

describe("needsCertificateOfCompletion", () => {
  it("requires a certificate only when completed and the transcript can't confirm it", () => {
    expect(needsCertificateOfCompletion(tertiary({ completed: true }))).toBe(true);
    expect(
      needsCertificateOfCompletion(
        tertiary({ completed: true, transcriptEligibility: completionAssessment("Completed") }),
      ),
    ).toBe(false);
    expect(needsCertificateOfCompletion(tertiary({ completed: false }))).toBe(false);
  });
});

describe("English inference and evidence", () => {
  it("infers English from an English-medium-country qualification", () => {
    expect(isEnglishInferableFromTranscripts(application({ tertiaryQualifications: [tertiary({ country: "Australia" })] }))).toBe(true);
    expect(isEnglishInferableFromTranscripts(application({ tertiaryQualifications: [tertiary({ country: "Indonesia" })] }))).toBe(false);
  });

  it("accepts a language test or an AHPRA registration as evidence", () => {
    expect(hasEnglishProficiencyEvidence(application({ languageTests: [{ id: "l1", type: "IELTS", name: "IELTS Academic", year: "2023" }] }))).toBe(true);
    expect(hasEnglishProficiencyEvidence(application({ professionalAccreditations: [accreditation("Registered Nurse")] }))).toBe(true);
    expect(hasEnglishProficiencyEvidence(application())).toBe(false);
  });
});

describe("needsEnglishProficiencyEvidence", () => {
  it("is required only when the course needs it, it can't be inferred, and no evidence is provided", () => {
    const overseas = application({ tertiaryQualifications: [tertiary({ country: "Indonesia" })] });
    expect(needsEnglishProficiencyEvidence(overseas, englishCourse)).toBe(true);

    // Satisfied by an AHPRA registration.
    expect(
      needsEnglishProficiencyEvidence(
        application({ tertiaryQualifications: [tertiary({ country: "Indonesia" })], professionalAccreditations: [accreditation("AHPRA registration")] }),
        englishCourse,
      ),
    ).toBe(false);

    // Inferable from an English-medium-country qualification.
    expect(needsEnglishProficiencyEvidence(application({ tertiaryQualifications: [tertiary({ country: "Australia" })] }), englishCourse)).toBe(false);

    // Course doesn't require English proficiency.
    expect(needsEnglishProficiencyEvidence(overseas, noEnglishCourse)).toBe(false);
  });
});

describe("courseRequiresEnglishProficiency", () => {
  it("reflects whether the course declares an english_proficiency requirement", () => {
    expect(courseRequiresEnglishProficiency(englishCourse)).toBe(true);
    expect(courseRequiresEnglishProficiency(noEnglishCourse)).toBe(false);
    expect(courseRequiresEnglishProficiency(null)).toBe(false);
  });
});
