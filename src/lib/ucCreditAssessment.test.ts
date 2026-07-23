import { describe, expect, it, vi } from "vitest";
import { getCourseCatalogFor } from "./courseCatalog";
import { normalizeTranscriptEligibilityAssessment } from "./eligibility/normalize";
import type { UcCourseMatch } from "./ucRplAssessment";
import {
  assessUcShortlistCredit,
  assessUcShortlistedCourseCredit,
  createBillShortenUcCreditDemoTranscriptAssessment,
  formatUcAssessmentCost,
  formatUcAssessmentDuration,
  hasUcTranscriptStudyEvidence,
  isBillShortenUcCreditDemoFixture,
  prepareUcCreditAssessment,
  UC_CREDIT_DEMO_ASSESSMENT_DELAY_MS,
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
    creditPoints: 18,
    entryConfidence: "high",
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

const billShortenDemoTranscript = normalizeTranscriptEligibilityAssessment({
  confidence: 0.97,
  outcome: "eligible",
  applicantDetails: {
    fullName: {
      confidence: 0.99,
      normalizedValue: "William (Bill) Shorten",
    },
    institutionName: {
      confidence: 0.98,
      normalizedValue: "Monash University, Australia",
    },
  },
  studyDetails: {
    highestEducationLevel: {
      confidence: 0.98,
      normalizedValue: "Bachelor",
    },
    programName: {
      confidence: 0.98,
      normalizedValue: "Bachelor of Arts / Bachelor of Laws",
    },
  },
});

describe("UC shortlisted-course credit assessment", () => {
  it("uses a short, identity-gated processing pause for the exact UC demo fixture", () => {
    const matches = [
      matchFor("Master of Education (Leadership)"),
      matchFor("Master of Education (STEM)"),
      matchFor("Graduate Certificate in Educational Leadership"),
    ];

    expect(
      isBillShortenUcCreditDemoFixture(matches, {
        firstName: "Bill",
        lastName: "Shorten",
      }),
    ).toBe(true);
    expect(
      isBillShortenUcCreditDemoFixture(matches, {
        firstName: "Jane",
        lastName: "Shorten",
      }),
    ).toBe(false);
    expect(UC_CREDIT_DEMO_ASSESSMENT_DELAY_MS).toBe(3_000);
    expect(
      hasUcTranscriptStudyEvidence(
        createBillShortenUcCreditDemoTranscriptAssessment(),
      ),
    ).toBe(true);
  });

  it("starts the real parser without making the demo cards wait for it", async () => {
    const parserAssessment = new Promise<TranscriptEligibilityAssessment>(() => {});
    const wait = vi.fn().mockResolvedValue(undefined);
    const run = prepareUcCreditAssessment({
      parserAssessment,
      usesFastDemoAssessment: true,
      wait,
    });

    await expect(run.cardAssessment).resolves.toMatchObject({
      extractedData: {
        studyDetails: {
          programName: {
            normalizedValue: "Bachelor of Arts / Bachelor of Laws",
          },
        },
      },
    });
    expect(run.parserAssessment).toBe(parserAssessment);
    expect(wait).toHaveBeenCalledWith(UC_CREDIT_DEMO_ASSESSMENT_DELAY_MS);
  });

  it("uses the parser result directly outside the fast demo fixture", () => {
    const parserAssessment = Promise.resolve(relatedTranscript);
    const run = prepareUcCreditAssessment({
      parserAssessment,
      usesFastDemoAssessment: false,
      wait: vi.fn(),
    });

    expect(run.cardAssessment).toBe(parserAssessment);
    expect(run.parserAssessment).toBe(parserAssessment);
  });

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

  it("applies the fixed UC demo estimate to Bill Shorten's two education master's courses only", () => {
    const results = assessUcShortlistCredit(
      [
        matchFor("Master of Education (Leadership)"),
        matchFor("Master of Education (STEM)"),
        matchFor("Graduate Certificate in Educational Leadership"),
      ],
      billShortenDemoTranscript,
      { applicant: { firstName: "Bill", lastName: "Shorten" } },
    );

    expect(results).toEqual([
      expect.objectContaining({
        afterCost: 17737.5,
        afterDurationMonths: 12,
        confidence: "medium",
        originalCost: 23650,
        originalDurationMonths: 16,
        potentialCreditPoints: 6,
        potentialSavings: 5912.5,
      }),
      expect.objectContaining({
        afterCost: 17737.5,
        afterDurationMonths: 12,
        confidence: "medium",
        originalCost: 23650,
        originalDurationMonths: 16,
        potentialCreditPoints: 6,
        potentialSavings: 5912.5,
      }),
      expect.objectContaining({
        afterCost: 11825,
        afterDurationMonths: 8,
        confidence: "low",
        originalCost: 11825,
        originalDurationMonths: 8,
        potentialCreditPoints: 0,
        potentialSavings: 0,
      }),
    ]);
    expect(results[0]?.evidenceSummary).toMatch(/transcript.*CV/i);
    expect(results[1]?.evidenceSummary).toMatch(/transcript.*CV/i);
  });

  it("does not apply the UC demo estimate to another applicant", () => {
    const result = assessUcShortlistedCourseCredit(
      matchFor("Master of Education (Leadership)"),
      billShortenDemoTranscript,
      { applicant: { firstName: "Another", lastName: "Applicant" } },
    );

    expect(result.potentialCreditPoints).toBe(0);
    expect(result.afterCost).toBe(result.originalCost);
    expect(result.afterDurationMonths).toBe(result.originalDurationMonths);
  });

  it("keeps the exact Bill Shorten demo result stable when transcript fields vary", () => {
    const results = assessUcShortlistCredit(
      [
        matchFor("Master of Education (Leadership)"),
        matchFor("Master of Education (STEM)"),
        matchFor("Graduate Certificate in Educational Leadership"),
      ],
      unrelatedTranscript,
      { applicant: { firstName: "William (Bill)", lastName: "Shorten" } },
    );

    expect(results.map((result) => result.potentialCreditPoints)).toEqual([
      6,
      6,
      0,
    ]);
    expect(results[0]).toMatchObject({
      afterCost: 17737.5,
      afterDurationMonths: 12,
    });
  });

  it("does not apply the UC demo estimate outside the exact three-course shortlist", () => {
    const result = assessUcShortlistedCourseCredit(
      matchFor("Master of Education (Leadership)"),
      billShortenDemoTranscript,
      { applicant: { firstName: "Bill", lastName: "Shorten" } },
    );

    expect(result.potentialCreditPoints).toBe(0);
  });

  it("uses the transcript identity when the CV profile name is unavailable", () => {
    const results = assessUcShortlistCredit(
      [
        matchFor("Master of Education (Leadership)"),
        matchFor("Master of Education (STEM)"),
        matchFor("Graduate Certificate in Educational Leadership"),
      ],
      billShortenDemoTranscript,
    );

    expect(results.map((result) => result.potentialCreditPoints)).toEqual([
      6,
      6,
      0,
    ]);
  });

  it("does not apply the UC demo estimate without usable transcript study evidence", () => {
    const results = assessUcShortlistCredit(
      [
        matchFor("Master of Education (Leadership)"),
        matchFor("Master of Education (STEM)"),
        matchFor("Graduate Certificate in Educational Leadership"),
      ],
      normalizeTranscriptEligibilityAssessment({ outcome: "insufficient_data" }),
      { applicant: { firstName: "Bill", lastName: "Shorten" } },
    );

    expect(results.map((result) => result.potentialCreditPoints)).toEqual([
      0,
      0,
      0,
    ]);
  });

  it("does not apply the UC demo estimate to an unlisted course", () => {
    const result = assessUcShortlistedCourseCredit(
      matchFor("Master of Education"),
      billShortenDemoTranscript,
      { applicant: { firstName: "Bill", lastName: "Shorten" } },
    );

    expect(result.potentialCreditPoints).toBe(0);
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
