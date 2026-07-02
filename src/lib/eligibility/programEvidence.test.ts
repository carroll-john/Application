import { describe, expect, it } from "vitest";
import type {
  ApplicationData,
  LanguageTest,
  ProfessionalAccreditation,
  TertiaryQualification,
} from "../applicationData";
import { initialApplicationData } from "../applicationData";
import type { CourseCatalogEntry } from "../courseCatalog";
import type { UploadedDocument } from "../documentStorage";
import {
  buildProgramEvidenceRows,
  filterResolvedTranscriptMissingInformation,
  shouldShowTranscriptRecommendedNextStep,
} from "./programEvidence";

function remoteDoc(id: string): UploadedDocument {
  return {
    id,
    name: `${id}.pdf`,
    size: 1024,
    type: "application/pdf",
    lastModified: 0,
    uploadedAt: "2026-01-01T00:00:00Z",
    source: "remote",
    storageBucket: "application-documents",
    storagePath: `path/${id}.pdf`,
  };
}

function application(overrides: Partial<ApplicationData> = {}): ApplicationData {
  return { ...initialApplicationData, ...overrides };
}

function languageTest(overrides: Partial<LanguageTest> = {}): LanguageTest {
  return {
    id: "lang-1",
    type: "IELTS",
    name: "IELTS Academic",
    year: "2025",
    overallScore: "6.5",
    listeningScore: "6",
    readingScore: "6",
    writingScore: "6",
    speakingScore: "6",
    document: remoteDoc("ielts"),
    documentName: "ielts.pdf",
    ...overrides,
  };
}

function accreditation(overrides: Partial<ProfessionalAccreditation> = {}): ProfessionalAccreditation {
  return {
    id: "ahpra-1",
    name: "AHPRA Registered Nurse",
    status: "Active",
    document: remoteDoc("ahpra"),
    documentName: "ahpra.pdf",
    ...overrides,
  };
}

function tertiaryQualification(
  overrides: Partial<TertiaryQualification> = {},
): TertiaryQualification {
  return {
    id: "tertiary-1",
    institution: "The University of Melbourne",
    country: "Australia",
    level: "Bachelor",
    courseName: "Bachelor of Information Technology",
    startMonth: "February",
    startYear: "2020",
    completed: true,
    endMonth: "December",
    endYear: "2023",
    ...overrides,
  };
}

const englishCourse = {
  code: "course-1",
  title: "Master of Nursing",
  requirements: [
    {
      id: "english",
      kind: "english_proficiency",
      params: {
        acceptedPathways: [
          { type: "completion_in_country", countries: ["AU", "NZ"] },
          { type: "english_test", test: "IELTS", minOverall: 6.5, minBand: 6 },
        ],
      },
      sourceText: "IELTS 6.5 overall with no band below 6.0.",
      weight: "mandatory",
    },
  ],
} as CourseCatalogEntry;

describe("buildProgramEvidenceRows", () => {
  it("marks English evidence met for a matching scored language test", () => {
    const rows = buildProgramEvidenceRows({
      applicationData: application({ languageTests: [languageTest()] }),
      course: englishCourse,
    });

    expect(rows[0]).toMatchObject({
      isBlocking: false,
      status: "met",
      statusLabel: "Met",
    });
  });

  it("blocks when English test scores are below the program threshold", () => {
    const rows = buildProgramEvidenceRows({
      applicationData: application({
        languageTests: [languageTest({ overallScore: "6.0", listeningScore: "5.5" })],
      }),
      course: englishCourse,
    });

    expect(rows[0]).toMatchObject({
      actionPath: "/section2/edit-language-test/lang-1?from=review",
      isBlocking: true,
      status: "needs_evidence",
    });
  });

  it("requires AHPRA evidence to be active and documented", () => {
    expect(
      buildProgramEvidenceRows({
        applicationData: application({
          professionalAccreditations: [accreditation()],
        }),
        course: englishCourse,
      })[0],
    ).toMatchObject({ isBlocking: false, status: "met" });

    expect(
      buildProgramEvidenceRows({
        applicationData: application({
          professionalAccreditations: [accreditation({ document: undefined })],
        }),
        course: englishCourse,
      })[0],
    ).toMatchObject({ isBlocking: true, status: "needs_details" });
  });

  it("hides raw English missing-info once program evidence satisfies English", () => {
    const rows = buildProgramEvidenceRows({
      applicationData: application({
        tertiaryQualifications: [tertiaryQualification()],
      }),
      course: englishCourse,
    });
    const visibleMissingInformation = filterResolvedTranscriptMissingInformation(
      [
        "English instruction confirmation",
        "English proficiency test or completion evidence",
        "WAM evidence",
      ],
      rows,
    );

    expect(rows[0]).toMatchObject({ status: "met" });
    expect(visibleMissingInformation).toEqual(["WAM evidence"]);
    expect(
      shouldShowTranscriptRecommendedNextStep(
        "Request confirmation or evidence of English instruction medium or valid English proficiency test.",
        [],
        rows,
      ),
    ).toBe(false);
  });

  it("keeps English missing-info when English evidence is not satisfied", () => {
    const rows = buildProgramEvidenceRows({
      applicationData: application(),
      course: englishCourse,
    });

    expect(
      filterResolvedTranscriptMissingInformation(
        ["English proficiency test or completion evidence"],
        rows,
      ),
    ).toEqual(["English proficiency test or completion evidence"]);
    expect(
      shouldShowTranscriptRecommendedNextStep(
        "Request valid English proficiency evidence.",
        ["English proficiency test or completion evidence"],
        rows,
      ),
    ).toBe(true);
  });
});
