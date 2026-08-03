import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { UcCreditAssessmentResult } from "../../lib/ucCreditAssessment";
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
    creditConfidence: "low",
    creditDetail: "Transcript assessment required.",
    creditPoints: null,
    entryConfidence: "high",
    relevanceScore: 30,
  })) satisfies UcCourseMatch[];
}

function result(
  overrides: Partial<UcCreditAssessmentResult> = {},
): UcCreditAssessmentResult {
  return {
    confidence: "medium",
    courseCode: "master-of-education-leadership",
    evidenceSummary: "Based only on 2 mapped transcript units.",
    manualReviewReasons: [],
    matchedTranscriptEvidence: [
      {
        creditPoints: 3,
        mappingId: "leadership",
        title: "Educational Leadership",
        unitCode: "EDU501",
      },
      {
        creditPoints: 3,
        mappingId: "curriculum",
        title: "Curriculum Design",
        unitCode: null,
      },
    ],
    potentialCreditPoints: 6,
    publishedCap: 12,
    versions: {
      catalogueVersion: "uc-online-2026-07-23",
      modelVersion: "transcript-evidence-v1",
      rulesVersion: "uc-credit-pilot-2026-08-04.1",
    },
    ...overrides,
  };
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
  it("requires authentication before transcript upload", () => {
    const signedOut = renderToStaticMarkup(
      createElement(UcCreditAssessmentPanel, {
        ...baseProps,
        isAuthenticated: false,
        status: "ready",
      }),
    );
    const signedIn = renderToStaticMarkup(
      createElement(UcCreditAssessmentPanel, {
        ...baseProps,
        isAuthenticated: true,
        status: "upload",
      }),
    );

    expect(signedOut).toContain("account prepared for your pilot invitation");
    expect(signedOut).not.toContain("Academic transcript");
    expect(signedIn).toContain("Academic transcript");
    expect(signedIn).toContain("Assess my credit");
  });

  it("shows indicative points, mapped evidence, the published cap, and UC confirmation", () => {
    const html = renderToStaticMarkup(
      createElement(UcCreditAssessmentComparison, { result: result() }),
    );

    expect(html).toContain("Up to 6 credit points");
    expect(html).toContain("Published course cap: 12 credit points");
    expect(html).toContain("EDU501: Educational Leadership");
    expect(html).toContain("not an admission offer or formal credit decision");
    expect(html).not.toMatch(/tuition|months|saving/i);
  });

  it("uses manual-review guidance rather than a zero-credit decision", () => {
    const html = renderToStaticMarkup(
      createElement(UcCreditAssessmentComparison, {
        result: result({
          confidence: "low",
          evidenceSummary: "UC will review the transcript.",
          manualReviewReasons: ["Insufficient mapped study evidence."],
          matchedTranscriptEvidence: [],
          potentialCreditPoints: null,
        }),
      }),
    );

    expect(html).toContain("Credit points need UC review");
    expect(html).toContain("Manual review");
    expect(html).not.toContain("0 credit points");
  });

  it("replaces provisional card copy with the trusted assessment", () => {
    const match = shortlist()[0]!;
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(UcRplMatchCard, {
          assessmentResult: result({ courseCode: match.course.code }),
          isAssessmentComplete: true,
          isShortlistFull: true,
          isShortlisted: true,
          isStarting: false,
          match,
          onStart: vi.fn(),
          onToggleShortlist: vi.fn(),
          onView: vi.fn(),
        }),
      ),
    );

    expect(html).toContain("Indicative credit guidance");
    expect(html).not.toContain("Initial credit potential");
    expect(html).not.toContain(match.creditDetail);
  });

  it("states that the CV may rank courses but cannot add credit points", () => {
    const complete = renderToStaticMarkup(
      createElement(UcCreditAssessmentPanel, {
        ...baseProps,
        isAuthenticated: true,
        status: "complete",
      }),
    );
    const processing = renderToStaticMarkup(
      createElement(UcCreditAssessmentPanel, {
        ...baseProps,
        isAuthenticated: true,
        status: "processing",
      }),
    );

    expect(complete).toContain("CV can help rank courses");
    expect(complete).toContain("cannot add credit points");
    expect(processing).toContain("CV experience cannot");
  });
});
