import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { getCourseCatalogFor } from "../../lib/courseCatalog";
import type { UcCourseMatch } from "../../lib/ucRplAssessment";
import { UcCreditAssessmentComparison } from "./UcCreditAssessmentComparison";
import { UcCreditAssessmentPanel } from "./UcCreditAssessmentPanel";
import { UcRplMatchCard } from "./UcRplCourseMatcher";

function shortlist() {
  return getCourseCatalogFor("uc").slice(0, 3).map((course) => ({
    admissionDetail: "Admissions review required.",
    category: "best_match",
    course,
    creditConfidence: "high",
    creditDetail: "Potential credit.",
    creditPoints: 12,
    entryConfidence: "high",
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
    expect(html).not.toContain("Sign in or create an account");
  });

  it("renders original and after-credit time and tuition together", () => {
    const html = renderToStaticMarkup(
      createElement(UcCreditAssessmentComparison, {
        result: {
          afterCost: 11825,
          afterDurationMonths: 8,
          confidence: "high",
          courseCode: "master-of-education-leadership",
          evidenceSummary: "Based on related prior study and experience.",
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
    expect(html).not.toContain("2026 indicative tuition only");
  });

  it("omits the redundant zero-credit summary while retaining faculty review status", () => {
    const html = renderToStaticMarkup(
      createElement(UcCreditAssessmentComparison, {
        result: {
          afterCost: 23650,
          afterDurationMonths: 16,
          confidence: "low",
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

  it("hides the provisional credit section after assessment", () => {
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
            courseCode: match.course.code,
            evidenceSummary:
              "Based on related prior study in your transcript and relevant professional experience in your CV.",
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
    expect(html).not.toContain("Initial credit potential");
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
