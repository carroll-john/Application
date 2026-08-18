import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { getCourseCatalogFor } from "../../lib/courseCatalog";
import type { UcCourseMatch } from "../../lib/ucRplAssessment";
import { UcCreditAssessmentComparison } from "./UcCreditAssessmentComparison";
import { UcCreditAssessmentPanel } from "./UcCreditAssessmentPanel";
import {
  UcRplExperienceSummaryDisclosure,
  UcRplMatchCard,
} from "./UcRplCourseMatcher";

function shortlist() {
  return getCourseCatalogFor("uc")
    .slice(0, 3)
    .map((course) => ({
      admissionDetail: "Admissions review required.",
      category: "best_match",
      course,
      creditConfidence: "high",
      creditDetail: "Potential credit.",
      entryConfidence: "high",
      entryPathway: "skilled_work",
      entryStatus: "may_meet",
      relevanceScore: 30,
    })) satisfies UcCourseMatch[];
}

const baseProps = {
  error: null,
  onAssess: vi.fn(),
  onClearTranscript: vi.fn(),
  onFileSelect: vi.fn(),
  onRequestAssessment: vi.fn(),
  shortlist: shortlist(),
  transcriptFile: null,
};

describe("UC credit assessment interface", () => {
  it("keeps the reviewed experience summary collapsed by default", () => {
    const html = renderToStaticMarkup(
      createElement(UcRplExperienceSummaryDisclosure, {
        experienceGuidance:
          "UC Admissions will review your responsibilities and confirm eligibility.",
        experienceMonths: 44,
        onEdit: vi.fn(),
        skillLevel: 1,
      }),
    );

    expect(html).toContain("Your experience summary");
    expect(html).toContain("Senior or highly specialised roles");
    expect(html).toContain("3.7 years experience");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("Show details");
    expect(html).not.toContain("Review my experience");
    expect(html).not.toContain("UC Admissions will review your responsibilities");
  });

  it("shows entry guidance without premature credit content", () => {
    const match = shortlist()[0]!;
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(UcRplMatchCard, {
          isAssessmentComplete: false,
          isShortlistFull: false,
          isShortlisted: false,
          isStarting: false,
          match,
          mediaVariantIndex: 0,
          onStart: vi.fn(),
          onToggleShortlist: vi.fn(),
          onView: vi.fn(),
        }),
      ),
    );

    expect(html).toContain("Entry guidance");
    expect(html).toContain(match.admissionDetail);
    expect(html).not.toContain("Credit assessment");
    expect(html).not.toContain("Assessed separately");
    expect(html).not.toContain(match.creditDetail);
  });

  it("prompts for authentication after three courses are shortlisted", () => {
    const html = renderToStaticMarkup(
      createElement(UcCreditAssessmentPanel, {
        ...baseProps,
        isAuthenticated: false,
        status: "ready",
      }),
    );

    expect(html).toContain("Your three-course shortlist is ready");
    expect(html).toContain("Sign in or create an account");
    expect(html).toContain("Complete credit assessment");
  });

  it("balances the shortlist summary around a prominent primary action", () => {
    const html = renderToStaticMarkup(
      createElement(UcCreditAssessmentPanel, {
        ...baseProps,
        isAuthenticated: true,
        status: "ready",
      }),
    );

    expect(html).toContain(
      "lg:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]",
    );
    expect(html).toContain("bg-[var(--background-tinted)]");
    expect(html).toContain("h-14 w-full justify-between");
    expect(html).toContain("sm:grid-cols-3");
    expect(html).toContain("Master of Business Administration");
  });

  it("shows the transcript control only after authentication", () => {
    const html = renderToStaticMarkup(
      createElement(UcCreditAssessmentPanel, {
        ...baseProps,
        isAuthenticated: true,
        status: "upload",
      }),
    );

    expect(html).toContain("Academic transcript");
    expect(html).toContain("Assess my credit");
    expect(html).toContain(
      "If you start an application, it will be securely added to your qualification",
    );
    expect(html).not.toContain("is not saved to an application");
    expect(html).not.toContain("Sign in or create an account");
  });

  it("renders original and after-credit time and tuition together", () => {
    const html = renderToStaticMarkup(
      createElement(UcCreditAssessmentComparison, {
        result: {
          afterCost: 11825,
          afterDurationMonths: 8,
          confidence: "high",
          costBasis: "full_fee",
          courseCode: "master-of-education-leadership",
          evidenceSummary:
            "We used your work experience and previous study to calculate this indicative credit assessment. UC will confirm any credit awarded.",
          originalCost: 23650,
          originalDurationMonths: 16,
          potentialCreditPoints: 12,
          potentialSavings: 11825,
        },
      }),
    );

    expect(html).toContain("Original");
    expect(html).toContain("After credit");
    expect(html).not.toContain("After potential credit");
    expect(html).toContain("16 months");
    expect(html).toContain("8 months");
    expect(html).toContain("$23,650");
    expect(html).toContain("$11,825");
    expect(html).toContain(
      "2026 indicative tuition. UC will confirm final fees.",
    );
  });

  it("shows a credit and time option without inventing tuition figures", () => {
    const html = renderToStaticMarkup(
      createElement(UcCreditAssessmentComparison, {
        result: {
          afterCost: null,
          afterDurationMonths: 9,
          confidence: "medium",
          costBasis: null,
          courseCode: "graduate-certificate-digital-marketing",
          evidenceSummary:
            "We used your work experience and previous study to calculate this indicative credit assessment. UC will confirm any credit awarded.",
          originalCost: null,
          originalDurationMonths: 12,
          potentialCreditPoints: 3,
          potentialSavings: null,
        },
      }),
    );

    expect(html).toContain("Up to 3 credit points indicated");
    expect(html).toContain("1 year");
    expect(html).toContain("9 months");
    expect(html).toContain(
      "UC will confirm any tuition impact during faculty review.",
    );
    expect(html).not.toContain("Confirm with UC");
  });

  it("labels a CSP price separately from full-fee tuition", () => {
    const html = renderToStaticMarkup(
      createElement(UcCreditAssessmentComparison, {
        result: {
          afterCost: 6522,
          afterDurationMonths: 9,
          confidence: "medium",
          costBasis: "csp",
          courseCode: "graduate-certificate-digital-marketing",
          evidenceSummary:
            "We used your work experience and previous study to calculate this indicative credit assessment. UC will confirm any credit awarded.",
          originalCost: 8696,
          originalDurationMonths: 12,
          potentialCreditPoints: 3,
          potentialSavings: 2174,
        },
      }),
    );

    expect(html).toContain("$8,696");
    expect(html).toContain("$6,522");
    expect(html).toContain(
      "2026 indicative CSP student contribution for eligible domestic students. UC will confirm final fees.",
    );
  });

  it("omits the redundant zero-credit summary while retaining faculty review status", () => {
    const html = renderToStaticMarkup(
      createElement(UcCreditAssessmentComparison, {
        result: {
          afterCost: 23650,
          afterDurationMonths: 16,
          confidence: "low",
          costBasis: "full_fee",
          courseCode: "master-of-education-leadership",
          evidenceSummary:
            "Your transcript and CV will need faculty review for a formal credit decision.",
          originalCost: 23650,
          originalDurationMonths: 16,
          potentialCreditPoints: 0,
          potentialSavings: 0,
        },
      }),
    );

    expect(html).toContain("Faculty review");
    expect(html).not.toContain(
      "No automatic credit estimate — faculty review required",
    );
  });

  it("shows course-specific credit only after assessment", () => {
    const match = shortlist()[0]!;
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(UcRplMatchCard, {
          assessmentResult: {
            afterCost: 11825,
            afterDurationMonths: 8,
            confidence: "high",
            costBasis: "full_fee",
            courseCode: match.course.code,
            evidenceSummary:
              "We used your work experience and previous study to calculate this indicative credit assessment. UC will confirm any credit awarded.",
            originalCost: 23650,
            originalDurationMonths: 16,
            potentialCreditPoints: 12,
            potentialSavings: 11825,
          },
          isAssessmentComplete: true,
          isShortlistFull: true,
          isShortlisted: true,
          isStarting: false,
          match,
          mediaVariantIndex: 0,
          onStart: vi.fn(),
          onToggleShortlist: vi.fn(),
          onView: vi.fn(),
        }),
      ),
    );

    expect(html).toContain("Entry guidance");
    expect(html).toContain("Your indicative credit assessment");
    expect(html).not.toContain("Assessed separately");
    expect(html).not.toContain(match.creditDetail);
  });

  it("describes the completed assessment as using the transcript and CV", () => {
    const html = renderToStaticMarkup(
      createElement(UcCreditAssessmentPanel, {
        ...baseProps,
        isAuthenticated: true,
        status: "complete",
      }),
    );

    expect(html).toContain("uses evidence from your transcript and CV");
    expect(html).not.toContain("guides only");
  });
});
