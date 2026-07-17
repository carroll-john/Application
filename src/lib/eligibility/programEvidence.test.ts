import { describe, expect, it } from "vitest";
import type {
  ApplicationData,
  EmploymentExperience,
  LanguageTest,
  ProfessionalAccreditation,
  TertiaryQualification,
} from "../applicationData";
import { initialApplicationData } from "../applicationData";
import type { CourseCatalogEntry } from "../courseCatalog";
import type { UploadedDocument } from "../documentStorage";
import { normalizeTranscriptEligibilityAssessment } from "./normalize";
import { buildWorkExperienceAssessment } from "./workExperience";
import {
  buildAssessmentCheckEvidenceRows,
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

function employmentExperience(
  overrides: Partial<EmploymentExperience> = {},
): EmploymentExperience {
  return {
    id: "role-1",
    company: "Example Company",
    position: "Operations Lead",
    type: "Full-time",
    startMonth: "January",
    startYear: "2021",
    endMonth: "December",
    endYear: "2023",
    currentRole: false,
    duties: "Led operational improvement projects and supervised a team.",
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
  it("marks a consolidated qualification-level row as already requiring completion", () => {
    const course = {
      code: "completed-bachelor-course",
      title: "Completed bachelor course",
      requirements: [
        {
          id: "completed-bachelor",
          kind: "qualification_level",
          params: { completedRequired: true, level: "bachelor" },
          sourceText: "Completion of a bachelor degree or higher.",
          weight: "mandatory",
        },
      ],
    } as CourseCatalogEntry;

    const [row] = buildProgramEvidenceRows({
      applicationData: application({ tertiaryQualifications: [tertiaryQualification()] }),
      course,
    });

    expect(row).toMatchObject({
      heading: "Bachelor degree or higher",
      requiresCompletedQualification: true,
    });
  });

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

  it("surfaces the observed WAM and sends below-threshold alternatives to CV upload", () => {
    const course = {
      code: "course-6",
      title: "Master of Analytics",
      requirements: [
        {
          id: "wam",
          kind: "academic_threshold",
          params: { metric: "wam", min: 65, scale: 100 },
          sourceText: "Minimum WAM of 65%.",
          weight: "mandatory",
        },
      ],
    } as CourseCatalogEntry;
    const transcriptAssessment = normalizeTranscriptEligibilityAssessment({
      checkedAt: "2026-07-04T00:00:00Z",
      outcome: "ineligible",
      requirementsChecked: [
        {
          id: "wam",
          requirement: "Minimum 65% WAM",
          status: "fail",
          reasonCode: "WAM_BELOW",
          details: { metric: "wam", observed: "59.0", required: "65" },
          explanation: "WAM is below the minimum.",
        },
      ],
      rulesVersion: "v1",
    });

    const rows = buildProgramEvidenceRows({
      applicationData: application({ tertiaryQualifications: [tertiaryQualification()] }),
      course,
      transcriptAssessment,
    });

    expect(rows[0]).toMatchObject({
      actionLabel: "Add CV",
      actionPath: "/section2/add-cv?from=review",
      explanation:
        "Your WAM of 59.0 is below the minimum of 65. Add a CV for admissions to consider an alternate pathway.",
      isBlocking: false,
      status: "possible_alternative",
    });
  });

  it("prompts for employment details instead of another CV when CV evidence already exists", () => {
    const course = {
      code: "course-6",
      title: "Master of Public Health",
      requirements: [
        {
          id: "work-experience",
          kind: "work_experience",
          params: { minYears: 2 },
          sourceText: "Applicants require two years of relevant work experience.",
          weight: "mandatory",
        },
      ],
    } as CourseCatalogEntry;

    const rows = buildProgramEvidenceRows({
      applicationData: application({
        cvDocument: remoteDoc("cv"),
        cvFileName: "cv.pdf",
        cvUploaded: true,
      }),
      course,
    });

    expect(rows[0]).toMatchObject({
      actionLabel: "Add employment experience",
      actionPath: "/section2/add-employment?from=review",
      isBlocking: true,
      status: "needs_evidence",
    });
  });

  it("shows a compact conditional result without mixing in the employer-letter action", () => {
    const requirement = {
      id: "work-experience",
      kind: "work_experience" as const,
      params: { minYears: 3 },
      sourceText: "Three years relevant work experience.",
      weight: "mandatory" as const,
    };
    const role = employmentExperience();
    const assessment = buildWorkExperienceAssessment({
      requirement,
      roles: [role],
      classifications: [{
        employmentExperienceId: role.id,
        relevanceStatus: "relevant",
        roleCriteriaStatus: "not_required",
        confidence: 0.9,
        explanation: "The duties demonstrate relevant operations work.",
        evidencePhrases: ["operational improvement projects"],
      }],
      checkedAt: "2026-07-16T00:00:00.000Z",
      promptVersion: "test@v1",
    });
    const [row] = buildProgramEvidenceRows({
      applicationData: application({
        employmentExperiences: [role],
        workExperienceAssessments: { [requirement.id]: assessment },
      }),
      course: { code: "work-course", title: "Work course", requirements: [requirement] } as CourseCatalogEntry,
    });

    expect(row).toMatchObject({
      isBlocking: false,
      status: "provisionally_met",
      statusLabel: "Appears to meet",
    });
    expect(row.actionLabel).toBeUndefined();
    expect(row.explanationItems).toBeUndefined();
  });

  it("keeps employer confirmation subject to admissions review", () => {
    const requirement = {
      id: "work-experience",
      kind: "work_experience" as const,
      params: { minYears: 3 },
      sourceText: "Three years relevant work experience.",
      weight: "mandatory" as const,
    };
    const role = employmentExperience({
      employerLetterDocument: remoteDoc("employer-letter"),
      employerLetterDocumentName: "employer-letter.pdf",
    });
    const assessment = buildWorkExperienceAssessment({
      requirement,
      roles: [role],
      classifications: [{
        employmentExperienceId: role.id,
        relevanceStatus: "relevant",
        roleCriteriaStatus: "not_required",
        confidence: 0.9,
        explanation: "Relevant operations work.",
        evidencePhrases: ["operational improvement projects"],
      }],
      checkedAt: "2026-07-16T00:00:00.000Z",
      promptVersion: "test@v1",
    });
    const [row] = buildProgramEvidenceRows({
      applicationData: application({
        employmentExperiences: [role],
        workExperienceAssessments: { [requirement.id]: assessment },
      }),
      course: { code: "work-course", title: "Work course", requirements: [requirement] } as CourseCatalogEntry,
    });

    expect(row).toMatchObject({ isBlocking: false, status: "provisionally_met" });
    expect(row.explanation).toContain("Employer confirmation has been supplied");
    expect(row.actionLabel).toBeUndefined();
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

describe("buildAssessmentCheckEvidenceRows", () => {
  function assessmentWithChecks(checks: unknown[]) {
    return normalizeTranscriptEligibilityAssessment({
      checkedAt: "2026-07-04T00:00:00Z",
      outcome: "insufficient_data",
      requirementsChecked: checks,
      rulesVersion: "v1+deterministic-v1",
    });
  }

  it("renders passing deterministic checks as met rows so evidence shows green", () => {
    const rows = buildAssessmentCheckEvidenceRows(
      assessmentWithChecks([
        {
          id: "deterministic-completion",
          requirement: "Completed qualification requirement",
          status: "pass",
          reasonCode: "QUALIFICATION_COMPLETE",
          explanation: "Qualification appears completed based on supplied evidence.",
        },
        {
          id: "deterministic-english-proficiency",
          requirement: "English language proficiency",
          status: "pass",
          reasonCode: "ENGLISH_OK_COUNTRY",
          details: { observed: "Australia" },
          explanation: "English satisfied by Australian study.",
        },
      ]),
    );

    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.status === "met" && !row.isBlocking)).toBe(true);
    expect(rows[0]).toMatchObject({
      heading: "Completed qualification requirement",
      requirementId: "deterministic-completion",
      requirementStatus: "pass",
      statusLabel: "Met",
    });
    // reasonCode copy, not the free-text explanation
    expect(rows[1].explanation).toBe(
      "English language proficiency is satisfied by study in Australia.",
    );

    const summary = buildTranscriptReviewSummary(rows);
    expect(summary.headerTone).toBe("success");
    expect(summary.manualReviewNeeded).toBe(false);
  });

  it("turns unknown checks into blocking rows that prompt a qualification review", () => {
    const rows = buildAssessmentCheckEvidenceRows(
      assessmentWithChecks([
        {
          id: "deterministic-wam-gpa-threshold",
          requirement: "Minimum WAM threshold (60)",
          status: "unknown",
          reasonCode: "ACADEMIC_EVIDENCE_MISSING",
          explanation: "No WAM or GPA found.",
        },
      ]),
    );

    expect(rows[0]).toMatchObject({
      actionLabel: "Review qualification",
      actionPath: "/section2/add-tertiary?from=review",
      isBlocking: true,
      status: "needs_details",
    });

    const summary = buildTranscriptReviewSummary(rows);
    expect(summary.headerTone).toBe("warning");
    expect(summary.missingItems).toEqual(["Minimum WAM threshold (60) — Add details"]);
  });

  it("keeps service outages and failed checks non-blocking for manual review", () => {
    const rows = buildAssessmentCheckEvidenceRows(
      assessmentWithChecks([
        {
          id: "service-availability",
          requirement: "Automated transcript eligibility evaluation availability",
          status: "unknown",
          reasonCode: "SERVICE_UNAVAILABLE",
          explanation: "External evaluation service response was unavailable.",
        },
        {
          id: "deterministic-completion",
          requirement: "Completed qualification requirement",
          status: "fail",
          reasonCode: "QUALIFICATION_INCOMPLETE",
          explanation: "Qualification appears incomplete.",
        },
      ]),
    );

    expect(rows.every((row) => row.status === "needs_review" && !row.isBlocking)).toBe(true);
    expect(buildTranscriptReviewSummary(rows).manualReviewNeeded).toBe(true);
  });

  it("labels the deterministic WAM/GPA check as an academic threshold kind", () => {
    const rows = buildAssessmentCheckEvidenceRows(
      assessmentWithChecks([
        {
          id: "deterministic-wam-gpa-threshold",
          requirement: "Minimum WAM threshold (60)",
          status: "pass",
          reasonCode: "WAM_MET",
          explanation: "WAM meets minimum.",
        },
      ]),
    );

    // The panel suppresses the duplicate extracted "Academic result" row on this label.
    expect(rows[0].kindLabel).toBe("Academic results threshold");
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
