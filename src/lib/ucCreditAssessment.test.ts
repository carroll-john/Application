import { describe, expect, it } from "vitest";
import { getCourseCatalogFor } from "./courseCatalog";
import { normalizeTranscriptEligibilityAssessment } from "./eligibility/normalize";
import type { UcCourseMatch } from "./ucRplAssessment";
import {
  assessUcShortlistedCourseCredit,
  formatUcAssessmentCost,
  formatUcAssessmentDuration,
  hasUcTranscriptStudyEvidence,
} from "./ucCreditAssessment";

function matchFor(title: string, creditConfidence: UcCourseMatch["creditConfidence"] = "high") {
  const course = getCourseCatalogFor("uc").find((item) => item.title === title);
  if (!course) throw new Error(`Missing UC test course: ${title}`);

  return {
    admissionDetail: "Admissions review required.",
    category: "best_match",
    course,
    creditConfidence,
    creditDetail: "Potential credit.",
    entryConfidence: "high",
    entryPathway: "skilled_work",
    entryStatus: "may_meet",
    relevanceScore: 30,
  } satisfies UcCourseMatch;
}

const relatedTranscript = normalizeTranscriptEligibilityAssessment({
  confidence: 0.94,
  outcome: "eligible",
  academicPerformance: {
    unitResults: [
      {
        counted: true,
        creditPoints: 12,
        grade: "D",
        title: "Educational Leadership and Change",
      },
    ],
  },
  studyDetails: {
    completionStatus: {
      confidence: 0.98,
      normalizedValue: "completed",
    },
    programName: {
      confidence: 0.96,
      normalizedValue: "Graduate Certificate in Educational Leadership",
    },
  },
});

const unrelatedTranscript = normalizeTranscriptEligibilityAssessment({
  confidence: 0.92,
  outcome: "eligible",
  academicPerformance: {
    unitResults: [
      {
        counted: true,
        creditPoints: 12,
        grade: "D",
        title: "Coral Reef Ecology",
      },
    ],
  },
  studyDetails: {
    programName: {
      confidence: 0.95,
      normalizedValue: "Graduate Certificate in Marine Biology",
    },
  },
});

const incompleteRelatedTranscript = normalizeTranscriptEligibilityAssessment({
  confidence: 0.96,
  outcome: "eligible",
  academicPerformance: {
    unitResults: [
      {
        counted: true,
        creditPoints: 6,
        grade: "D",
        title: "Educational Leadership and Change",
      },
      {
        counted: true,
        creditPoints: 6,
        grade: "C",
        title: "Learning and Development at Work",
      },
    ],
  },
  studyDetails: {
    completionStatus: {
      confidence: 0.99,
      normalizedValue: "not_completed",
      originalValue: "Course discontinued - no award conferred",
    },
    programName: {
      confidence: 0.98,
      normalizedValue: "Bachelor of Business (Management)",
    },
  },
});

describe("UC shortlisted-course credit assessment", () => {
  it("combines related transcript study and CV relevance into time and cost estimates", () => {
    const result = assessUcShortlistedCourseCredit(
      matchFor("Master of Education (Leadership)"),
      relatedTranscript,
    );

    expect(result).toMatchObject({
      afterCost: 11825,
      afterDurationMonths: 8,
      confidence: "high",
      originalCost: 23650,
      originalDurationMonths: 16,
      potentialCreditPoints: 12,
      potentialSavings: 11825,
    });
    expect(result.evidenceSummary).toMatch(/prior study.*professional experience/i);
  });

  it("uses related completed units when the synthetic bachelor award is incomplete", () => {
    const result = assessUcShortlistedCourseCredit(
      matchFor("Master of Education (Leadership)"),
      incompleteRelatedTranscript,
    );

    expect(result).toMatchObject({
      afterCost: 11825,
      afterDurationMonths: 8,
      confidence: "high",
      originalCost: 23650,
      originalDurationMonths: 16,
      potentialCreditPoints: 12,
      potentialSavings: 11825,
    });
    expect(result.evidenceSummary).toMatch(/prior study.*professional experience/i);
  });

  it("does not estimate credit from CV relevance without related transcript study", () => {
    const result = assessUcShortlistedCourseCredit(
      matchFor("Master of Education (Leadership)"),
      unrelatedTranscript,
    );

    expect(result.potentialCreditPoints).toBe(0);
    expect(result.afterCost).toBe(result.originalCost);
    expect(result.afterDurationMonths).toBe(result.originalDurationMonths);
    expect(result.evidenceSummary).toMatch(/transcript and CV/i);
  });

  it("keeps graduate certificates on formal review when no approved credit arrangement is published", () => {
    const result = assessUcShortlistedCourseCredit(
      matchFor("Graduate Certificate in Educational Leadership"),
      relatedTranscript,
    );

    expect(result.potentialCreditPoints).toBe(0);
    expect(result.afterCost).toBe(result.originalCost);
    expect(result.afterDurationMonths).toBe(result.originalDurationMonths);
    expect(result.confidence).toBe("low");
  });

  it("shows explicit confirmation copy when published cost data is unavailable", () => {
    const result = assessUcShortlistedCourseCredit(
      matchFor("Master of Professional Psychology", "medium"),
      relatedTranscript,
    );

    expect(result.originalCost).toBeNull();
    expect(formatUcAssessmentCost(result.originalCost)).toBe("Confirm with UC");
    expect(formatUcAssessmentDuration(result.originalDurationMonths)).toBe(
      "Confirm with UC",
    );
  });

  it("formats applicant-facing Australian estimates", () => {
    expect(formatUcAssessmentCost(11825)).toBe("$11,825");
    expect(formatUcAssessmentDuration(8)).toBe("8 months");
    expect(formatUcAssessmentDuration(12)).toBe("1 year");
    expect(formatUcAssessmentDuration(18)).toBe("18 months");
  });

  it("requires extracted transcript study evidence before showing results", () => {
    expect(hasUcTranscriptStudyEvidence(relatedTranscript)).toBe(true);
    expect(
      hasUcTranscriptStudyEvidence(
        normalizeTranscriptEligibilityAssessment({ outcome: "insufficient_data" }),
      ),
    ).toBe(false);
  });
});
