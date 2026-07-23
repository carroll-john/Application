import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getCourseCatalogFor } from "../../lib/courseCatalog";
import type { UcCourseMatch } from "../../lib/ucRplAssessment";
import { UcCreditAssessmentComparison } from "./UcCreditAssessmentComparison";
import { UcCreditAssessmentPanel } from "./UcCreditAssessmentPanel";

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

describe("UC credit assessment UI", () => {
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
    expect(html).toContain("After potential credit");
    expect(html).toContain("16 months");
    expect(html).toContain("8 months");
    expect(html).toContain("$23,650");
    expect(html).toContain("$11,825");
  });
});
