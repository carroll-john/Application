import { describe, expect, it } from "vitest";
import { normalizeTranscriptEligibilityAssessment } from "../eligibility/normalize";
import {
  evaluateUcTranscriptCredit,
  findStaleUcGovernanceSources,
  UC_ASSESSMENT_RULES_VERSION,
  type UcGovernedCourse,
} from "./ucGovernance";

const approvedCourse: UcGovernedCourse = {
  approval: {
    approvedAt: "2026-08-04T00:00:00.000Z",
    approvedBy: "uc-pilot-owner",
    status: "approved",
  },
  courseCode: "master-of-education-stem",
  courseTitle: "Master of Education (STEM)",
  expiresAt: "2026-09-30",
  mappings: [
    { id: "stem", patterns: ["stem education"] },
    { id: "research", patterns: ["educational research"] },
  ],
  pointsPerMatchedUnit: 3,
  publishedCap: 6,
  sourceUrl: "https://example.test/uc",
  sourceVerifiedAt: "2026-08-01",
};

function transcript(unitTitles: string[]) {
  return normalizeTranscriptEligibilityAssessment({
    confidence: 0.9,
    manualReviewRequired: false,
    outcome: "eligible",
    academicPerformance: {
      unitResults: unitTitles.map((title) => ({ counted: true, title })),
    },
  });
}

describe("UC credit governance", () => {
  it("returns null for an ungoverned course", () => {
    const result = evaluateUcTranscriptCredit({
      assessment: transcript(["Educational Research"]),
      courseCode: "master-of-public-policy",
      now: new Date("2026-08-04T00:00:00.000Z"),
    });

    expect(result.potentialCreditPoints).toBeNull();
    expect(result.manualReviewReasons).toContain(
      "This course is not governed for automated credit guidance in the UC pilot.",
    );
  });

  it("fails closed until the exact rules version is UC approved", () => {
    const result = evaluateUcTranscriptCredit({
      assessment: transcript(["STEM Education"]),
      courseCode: approvedCourse.courseCode,
      courses: [{ ...approvedCourse, approval: { approvedAt: null, approvedBy: null, status: "pending_uc_approval" } }],
      now: new Date("2026-08-04T00:00:00.000Z"),
    });

    expect(result.potentialCreditPoints).toBeNull();
  });

  it("derives and caps estimates from distinct transcript units only", () => {
    const result = evaluateUcTranscriptCredit({
      approvedRulesVersion: UC_ASSESSMENT_RULES_VERSION,
      assessment: transcript([
        "STEM Education",
        "STEM Education Practice",
        "Educational Research",
      ]),
      courseCode: approvedCourse.courseCode,
      courses: [approvedCourse],
      now: new Date("2026-08-04T00:00:00.000Z"),
    });

    expect(result.potentialCreditPoints).toBe(6);
    expect(result.matchedTranscriptEvidence).toHaveLength(2);
    expect(result.potentialCreditPoints).toBeLessThanOrEqual(result.publishedCap!);
  });

  it("returns null instead of zero when transcript evidence is insufficient", () => {
    const result = evaluateUcTranscriptCredit({
      approvedRulesVersion: UC_ASSESSMENT_RULES_VERSION,
      assessment: transcript(["Unrelated unit"]),
      courseCode: approvedCourse.courseCode,
      courses: [approvedCourse],
      now: new Date("2026-08-04T00:00:00.000Z"),
    });

    expect(result.potentialCreditPoints).toBeNull();
    expect(result.confidence).toBe("low");
  });

  it("identifies governed sources older than 30 days", () => {
    expect(
      findStaleUcGovernanceSources(new Date("2026-09-05T00:00:00.000Z"), [
        approvedCourse,
      ]),
    ).toEqual([approvedCourse]);
  });
});
