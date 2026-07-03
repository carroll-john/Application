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
  buildTranscriptReviewSummary,
  dedupeProgramEvidenceRowsByHeading,
  groupTranscriptVerifiableEvidenceRows,
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

  it("reports a satisfied summary with no bullets when nothing is blocking", () => {
    const rows = buildProgramEvidenceRows({
      applicationData: application({
        tertiaryQualifications: [tertiaryQualification()],
      }),
      course: englishCourse,
    });
    const summary = buildTranscriptReviewSummary(rows);

    expect(rows[0]).toMatchObject({ status: "met" });
    expect(summary.headerTone).toBe("success");
    expect(summary.missingItems).toEqual([]);
    expect(summary.nextStep).toBeUndefined();
    expect(summary.manualReviewNeeded).toBe(false);
  });

  it("derives bullets and next step only from blocking rows", () => {
    const rows = buildProgramEvidenceRows({
      applicationData: application(),
      course: englishCourse,
    });
    const summary = buildTranscriptReviewSummary(rows);

    expect(rows[0]).toMatchObject({ isBlocking: true });
    expect(summary.headerTone).toBe("warning");
    expect(summary.headerLine).toContain("1 item");
    expect(summary.missingItems).toEqual([`${rows[0].heading} — ${rows[0].statusLabel}`]);
    expect(summary.nextStep).toContain(rows[0].actionLabel);
  });

  it("emits one row per alternative entry pathway even when their headings match", () => {
    const course = {
      code: "course-2",
      title: "Master of Business Administration (Digital)",
      requirements: [
        {
          id: "level-entry-1",
          kind: "qualification_level",
          alternativeGroupId: "entry-1",
          params: { level: "bachelor" },
          sourceText: "A bachelor degree or higher.",
          weight: "alternative",
        },
        {
          id: "level-entry-2",
          kind: "qualification_level",
          alternativeGroupId: "entry-2",
          params: { level: "bachelor" },
          sourceText: "A bachelor degree or higher in a related field.",
          weight: "alternative",
        },
      ],
    } as CourseCatalogEntry;

    const rows = buildProgramEvidenceRows({
      applicationData: application({ tertiaryQualifications: [tertiaryQualification()] }),
      course,
    });

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.heading)).toEqual([
      "Bachelor degree or higher",
      "Bachelor degree or higher",
    ]);
  });

  it("orders English language proficiency ahead of work experience regardless of source order", () => {
    const course = {
      code: "course-5",
      title: "Master of Business Administration",
      requirements: [
        {
          id: "work-experience",
          kind: "work_experience",
          params: { minYears: 3 },
          sourceText: "3+ years of relevant work experience.",
          weight: "mandatory",
        },
        {
          id: "english",
          kind: "english_proficiency",
          params: {
            acceptedPathways: [{ type: "completion_in_country", countries: ["AU", "NZ"] }],
          },
          sourceText: "English instruction confirmation or an approved English test.",
          weight: "mandatory",
        },
      ],
    } as CourseCatalogEntry;

    const rows = buildProgramEvidenceRows({
      applicationData: application({ tertiaryQualifications: [tertiaryQualification()] }),
      course,
    });

    expect(rows.map((row) => row.requirementId)).toEqual(["english", "work-experience"]);
  });
});

describe("groupTranscriptVerifiableEvidenceRows", () => {
  it("folds a satisfied English proficiency row into the Academic transcript card", () => {
    const course = {
      code: "course-4",
      title: "Master of Business Administration (Digital)",
      requirements: [
        {
          id: "level",
          kind: "qualification_level",
          params: { level: "bachelor" },
          sourceText: "A bachelor degree or higher.",
          weight: "mandatory",
        },
        {
          id: "wam",
          kind: "academic_threshold",
          params: { metric: "wam", min: 65 },
          sourceText: "Minimum WAM of 65%.",
          weight: "mandatory",
        },
        {
          id: "english",
          kind: "english_proficiency",
          params: {
            acceptedPathways: [{ type: "completion_in_country", countries: ["AU", "NZ"] }],
          },
          sourceText: "English instruction confirmation or an approved English test.",
          weight: "mandatory",
        },
      ],
    } as CourseCatalogEntry;

    const rows = buildProgramEvidenceRows({
      applicationData: application({ tertiaryQualifications: [tertiaryQualification()] }),
      course,
    });
    const englishRow = rows.find((row) => row.id === "english");
    expect(englishRow).toMatchObject({ status: "met" });

    const grouped = groupTranscriptVerifiableEvidenceRows(rows);

    expect(grouped).toHaveLength(1);
    expect(grouped[0]).toMatchObject({ heading: "Academic transcript" });
    expect(grouped[0].explanationItems).toContain("Your English language proficiency");
  });
});

describe("dedupeProgramEvidenceRowsByHeading", () => {
  it("keeps the first row per unique heading", () => {
    const course = {
      code: "course-3",
      title: "Master of Business Administration (Digital)",
      requirements: [
        {
          id: "level-entry-1",
          kind: "qualification_level",
          alternativeGroupId: "entry-1",
          params: { level: "bachelor" },
          sourceText: "A bachelor degree or higher.",
          weight: "alternative",
        },
        {
          id: "level-entry-2",
          kind: "qualification_level",
          alternativeGroupId: "entry-2",
          params: { level: "bachelor" },
          sourceText: "A bachelor degree or higher in a related field.",
          weight: "alternative",
        },
        {
          id: "wam",
          kind: "academic_threshold",
          params: { metric: "wam", min: 65 },
          sourceText: "Minimum WAM of 65%.",
          weight: "mandatory",
        },
      ],
    } as CourseCatalogEntry;

    const rows = buildProgramEvidenceRows({
      applicationData: application({ tertiaryQualifications: [tertiaryQualification()] }),
      course,
    });

    const deduped = dedupeProgramEvidenceRowsByHeading(rows);

    expect(deduped.map((row) => row.heading)).toEqual([
      "Bachelor degree or higher",
      "Minimum 65 WAM",
    ]);
    expect(deduped[0].requirementId).toBe("level-entry-1");
  });
});
