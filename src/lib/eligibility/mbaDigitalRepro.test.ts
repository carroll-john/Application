import { describe, expect, it } from "vitest";
import { applyEligibilityResolution } from "../../../api/_eligibility/assessment";
import { buildSection2EvidencePlan } from "../../features/section2/section2EvidencePlan";
import { initialApplicationData } from "../applicationData";
import { getCourseByCode } from "../courseCatalog";
import { aggregateOutcome, evaluateRequirements } from "./matcher";
import {
  buildProgramEvidenceRows,
  dedupeProgramEvidenceRowsByHeading,
  groupTranscriptVerifiableEvidenceRows,
} from "./programEvidence";
import { normalizeTranscriptEligibilityAssessment } from "./normalize";
import type { TranscriptExtractedData } from "./types";

const macquarieUnitResults = [
  { counted: true, creditPoints: 10, grade: "D", mark: 71 },
  { counted: true, creditPoints: 10, grade: "Cr", mark: 66 },
  { counted: true, creditPoints: 10, grade: "P", mark: 58 },
  { counted: true, creditPoints: 10, grade: "S", mark: null },
  { counted: true, creditPoints: 10, grade: "F", mark: 41 },
  { counted: true, creditPoints: 10, grade: "W", mark: null },
];

function buildMacquarieAssessment(
  courseCode: string,
  requirements: NonNullable<ReturnType<typeof getCourseByCode>>["requirements"],
  options?: { includeUnitResults?: boolean; wamOverride?: string },
) {
  const resolved = applyEligibilityResolution(
    {
      academicPerformance: {
        gradeAverageOrWam: {
          confidence: 0.9,
          normalizedValue: options?.wamOverride ?? "65",
          originalValue: `WAM ${options?.wamOverride ?? "65"}`,
        },
        gpa: {
          confidence: 0.9,
          normalizedValue: "5.25",
          originalValue: "GPA 5.25",
        },
        gpaScale: {
          confidence: 0.9,
          normalizedValue: "7",
          originalValue: "7",
        },
        ...(options?.includeUnitResults === false
          ? {}
          : { unitResults: macquarieUnitResults }),
      },
      studyDetails: {
        completionStatus: {
          confidence: 0.9,
          normalizedValue: "completed",
          originalValue: "Award conferred",
        },
        highestEducationLevel: {
          confidence: 0.9,
          normalizedValue: "Graduate Certificate",
          originalValue: "Graduate Certificate of Business",
        },
        programName: {
          confidence: 0.9,
          normalizedValue: "Graduate Certificate of Business",
          originalValue: "Graduate Certificate of Business",
        },
      },
      applicantDetails: {
        countryOfInstitution: {
          confidence: 0.9,
          normalizedValue: "Australia",
          originalValue: "Australia",
        },
        institutionName: {
          confidence: 0.9,
          normalizedValue: "Macquarie University",
          originalValue: "Macquarie University",
        },
      },
    },
    {
      completed: true,
      country: "Australia",
      courseCode,
      requirements,
      minWam: 60,
    },
  );

  return normalizeTranscriptEligibilityAssessment({
    ...resolved,
    checkedAt: "2026-07-06T00:00:00Z",
    rulesVersion: "v1",
  });
}

describe("MBA Digital + Macquarie transcript (AU-TX-V3-011)", () => {
  it("does not prompt to add a transcript when one is already attached", () => {
    const course = getCourseByCode("master-of-business-administration-digital");
    const assessment = buildMacquarieAssessment(course!.code, course!.requirements);
    const data = {
      ...initialApplicationData,
      tertiaryQualifications: [
        {
          id: "t1",
          institution: "Macquarie University",
          country: "Australia",
          level: "Graduate Certificate",
          courseName: "Graduate Certificate of Business",
          startMonth: "February",
          startYear: "2023",
          completed: true,
          endMonth: "June",
          endYear: "2025",
          transcriptDocument: {
            id: "d1",
            name: "AU-TX-V3-011_macquarie_university.pdf",
            size: 1,
            type: "application/pdf",
            lastModified: 0,
            uploadedAt: "2026-01-01",
            source: "remote" as const,
            storageBucket: "b",
            storagePath: "p",
          },
          transcriptEligibility: assessment,
        },
      ],
    };

    const rows = buildProgramEvidenceRows({
      applicationData: data,
      course,
      transcriptAssessment: assessment,
    });
    const grouped = dedupeProgramEvidenceRowsByHeading(
      groupTranscriptVerifiableEvidenceRows(rows),
    );
    const plan = buildSection2EvidencePlan({
      data,
      groupedRows: grouped,
      hasPublishedRequirements: true,
      skippedSections: new Set(),
    });

    expect(grouped.some((row) => row.isBlocking && row.actionLabel === "Add transcript")).toBe(
      false,
    );
    expect(plan.nextPrompt).toBeNull();
    expect(rows.find((row) => row.id === "qualification_completed-gradcert-busadmin-digital")).toMatchObject({
      heading: "Completed qualification",
      status: "met",
    });
  });

  it("uses calculated WAM 59 instead of the conflicting extracted aggregate", () => {
    const course = getCourseByCode("master-of-business-administration-digital");
    const assessment = buildMacquarieAssessment(course!.code, course!.requirements);

    const wamChecks = assessment.requirementsChecked?.filter((check) =>
      check.id.startsWith("academic_threshold"),
    );

    expect(wamChecks?.every((check) => check.details?.observed === "59.0")).toBe(true);
    expect(wamChecks?.every((check) => check.status === "fail")).toBe(true);
  });

  it("treats graduate certificate as satisfying Level 1 bachelor-or-equivalent", () => {
    const course = getCourseByCode("master-of-business-administration-digital");
    const assessment = buildMacquarieAssessment(course!.code, course!.requirements, {
      includeUnitResults: false,
      wamOverride: "72",
    });

    const levelCheck = assessment.requirementsChecked?.find(
      (check) => check.id === "qualification_level-bachelor",
    );

    expect(levelCheck?.status).toBe("pass");
    expect(assessment.outcome).toBe("eligible");
    expect(
      assessment.requirementsChecked?.some(
        (check) => check.id === "qualification_completed-gradcert-busadmin-digital",
      ),
    ).toBe(true);
  });

  it("does not let Level 2 requirements block when Level 1 pathway is fully satisfied", () => {
    const course = getCourseByCode("master-of-business-administration-digital");
    expect(course?.requirements?.length).toBeGreaterThan(0);

    const evidence: TranscriptExtractedData = {
      studyDetails: {
        completionStatus: { confidence: 0.9, normalizedValue: "completed" },
        highestEducationLevel: {
          confidence: 0.9,
          normalizedValue: "Graduate Certificate of Business",
        },
      },
      academicPerformance: {
        gradeAverageOrWam: { confidence: 0.9, normalizedValue: "72" },
      },
    };

    const checks = evaluateRequirements(course!.requirements!, evidence, {
      completed: true,
      level: "Graduate Certificate",
    });

    expect(checks.map((check) => check.id).sort()).toEqual([
      "academic_threshold-60",
      "academic_threshold-60-level2",
      "qualification_completed-gradcert-busadmin-digital",
      "qualification_level-bachelor",
    ]);
    expect(aggregateOutcome(checks)).toEqual({
      outcome: "eligible",
      manualReviewRequired: false,
    });
  });
});
