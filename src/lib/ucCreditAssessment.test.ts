import { describe, expect, it, vi } from "vitest";
import {
  UC_ASSESSMENT_RULES_VERSION,
  type UcGovernedCourse,
} from "./assessment/ucGovernance";
import { getCourseCatalogFor } from "./courseCatalog";
import { normalizeTranscriptEligibilityAssessment } from "./eligibility/normalize";
import type { UcCourseMatch } from "./ucRplAssessment";
import {
  assessUcShortlistCredit,
  assessUcShortlistedCourseCredit,
  hasUcTranscriptStudyEvidence,
  resolveUcTranscriptAssessmentForApplication,
} from "./ucCreditAssessment";

function matchFor(title: string) {
  const course = getCourseCatalogFor("uc").find((item) => item.title === title);
  if (!course) throw new Error(`Missing UC test course: ${title}`);

  return {
    admissionDetail: "Admissions review required.",
    category: "best_match",
    course,
    creditConfidence: "low",
    creditDetail: "Transcript assessment required.",
    creditPoints: null,
    entryConfidence: "high",
    relevanceScore: 30,
  } satisfies UcCourseMatch;
}

const transcript = normalizeTranscriptEligibilityAssessment({
  confidence: 0.94,
  outcome: "eligible",
  academicPerformance: {
    unitResults: [
      { counted: true, title: "Educational Leadership and Change" },
      { counted: true, title: "Curriculum and Pedagogy" },
      { counted: true, title: "Educational Research Methods" },
      { counted: true, title: "Learning and Assessment" },
      { counted: true, title: "Professional Experience Portfolio" },
    ],
  },
  studyDetails: {
    programName: {
      confidence: 0.96,
      normalizedValue: "Graduate Certificate in Educational Leadership",
    },
  },
});

const approvedLeadershipCourse: UcGovernedCourse = {
  approval: {
    approvedAt: "2026-08-04",
    approvedBy: "UC Academic Registrar",
    status: "approved",
  },
  courseCode: "master-of-education-leadership",
  courseTitle: "Master of Education (Leadership)",
  expiresAt: "2026-12-31",
  mappings: [
    { id: "leadership", patterns: ["educational leadership"] },
    { id: "curriculum", patterns: ["curriculum"] },
    { id: "research", patterns: ["educational research"] },
    { id: "assessment", patterns: ["assessment"] },
  ],
  pointsPerMatchedUnit: 3,
  publishedCap: 9,
  sourceUrl: "https://example.test/uc-approved-rules",
  sourceVerifiedAt: "2026-08-04",
};

describe("UC shortlisted-course credit assessment", () => {
  it("fails closed until the governed rules have explicit UC approval", () => {
    const result = assessUcShortlistedCourseCredit(
      matchFor("Master of Education (Leadership)"),
      transcript,
    );

    expect(result.potentialCreditPoints).toBeNull();
    expect(result.confidence).toBe("low");
    expect(result.manualReviewReasons[0]).toMatch(/UC approval is required/i);
  });

  it("derives points only from distinct mapped transcript units and enforces the cap", () => {
    const result = assessUcShortlistedCourseCredit(
      matchFor("Master of Education (Leadership)"),
      transcript,
      {
        approvedRulesVersion: UC_ASSESSMENT_RULES_VERSION,
        courses: [approvedLeadershipCourse],
        now: new Date("2026-08-05T00:00:00Z"),
      },
    );

    expect(result).toMatchObject({
      confidence: "high",
      potentialCreditPoints: 9,
      publishedCap: 9,
    });
    expect(result.matchedTranscriptEvidence).toHaveLength(3);
    expect(result.evidenceSummary).toMatch(/only on 3 mapped transcript units/i);
  });

  it("returns null rather than zero for ungoverned courses", () => {
    const [result] = assessUcShortlistCredit(
      [matchFor("Graduate Certificate in Educational Leadership")],
      transcript,
      {
        approvedRulesVersion: UC_ASSESSMENT_RULES_VERSION,
        courses: [approvedLeadershipCourse],
      },
    );

    expect(result.potentialCreditPoints).toBeNull();
    expect(result.publishedCap).toBeNull();
    expect(result.manualReviewReasons[0]).toMatch(/not governed/i);
  });

  it("retries only a transport failure before application handoff", async () => {
    const retryParserAssessment = vi.fn().mockResolvedValue(transcript);

    await expect(
      resolveUcTranscriptAssessmentForApplication({
        parserAssessment: Promise.reject(new TypeError("Failed to fetch")),
        startParserAssessment: retryParserAssessment,
      }),
    ).resolves.toBe(transcript);
    expect(retryParserAssessment).toHaveBeenCalledOnce();

    const evidenceFailure = new Error("Transcript study evidence is missing");
    await expect(
      resolveUcTranscriptAssessmentForApplication({
        parserAssessment: Promise.reject(evidenceFailure),
        startParserAssessment: retryParserAssessment,
      }),
    ).rejects.toBe(evidenceFailure);
    expect(retryParserAssessment).toHaveBeenCalledOnce();
  });

  it("recognises study evidence without inspecting applicant identity", () => {
    expect(hasUcTranscriptStudyEvidence(transcript)).toBe(true);
    expect(
      hasUcTranscriptStudyEvidence(
        normalizeTranscriptEligibilityAssessment({
          confidence: 0.5,
          outcome: "manual_review",
        }),
      ),
    ).toBe(false);
  });
});
