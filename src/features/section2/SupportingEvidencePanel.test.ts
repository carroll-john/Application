import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { normalizeTranscriptEligibilityAssessment } from "../../lib/eligibility/normalize";
import type { ProgramEvidenceRow } from "../../lib/eligibility/programEvidence";
import type { Section2EvidencePlan } from "./section2EvidencePlan";
import { SupportingEvidencePanel } from "./SupportingEvidencePanel";

const rows: ProgramEvidenceRow[] = [
  {
    explanation: "Your qualification meets the required level.",
    heading: "Bachelor degree or higher",
    id: "qualification-level",
    isBlocking: false,
    kindLabel: "Qualification level",
    reasonCode: "QUALIFICATION_LEVEL_MET",
    requiresCompletedQualification: true,
    requirementId: "qualification-level",
    requirementStatus: "pass",
    sourceText: "A completed bachelor degree or higher.",
    status: "met",
    statusLabel: "Met",
  },
  {
    actionLabel: "Add CV",
    actionPath: "/section2/add-cv?from=review",
    explanation:
      "Your WAM of 59.0 is below the minimum of 60. Add a CV for admissions to consider an alternate pathway.",
    heading: "Minimum WAM 60",
    id: "academic-threshold",
    isBlocking: false,
    kindLabel: "Academic threshold",
    reasonCode: "WAM_BELOW",
    requirementId: "academic-threshold",
    requirementStatus: "fail",
    sourceText: "A credit average of 60%.",
    status: "possible_alternative",
    statusLabel: "Possible alternative",
  },
];

const plan: Section2EvidencePlan = {
  hasAnyEvidence: true,
  hasSkips: false,
  isEvidenceReady: false,
  mode: "requirements",
  nextPrompt: {
    actionLabel: "Add CV",
    actionPath: "/section2/add-cv",
    explanation: "Add evidence of 3+ years' relevant experience.",
    heading: "Relevant Work Experience",
    sectionKey: "cv",
    source: "requirement",
  },
  remainingPromptCount: 1,
  skippedPrompts: [],
  suggestion: null,
  visibleSections: new Set(["tertiary"]),
};

describe("SupportingEvidencePanel", () => {
  it("hides the complete eligibility panel while transcript evidence is processing", () => {
    const html = renderToStaticMarkup(
      createElement(SupportingEvidencePanel, {
        courseTitle: "Master of Business Administration (Government)",
        ensureApplicationRow: async () => "application-id",
        isHero: false,
        isProcessing: true,
        onNavigate: () => undefined,
        onSaveFeedback: async () => undefined,
        onSkipPrompt: () => undefined,
        onUnskipPrompt: () => undefined,
        plan,
        showParsedTranscriptIntro: false,
        ungroupedRows: rows,
      }),
    );

    expect(html).toBe("");
  });

  it("stages completed eligibility fields in reading order", () => {
    const html = renderToStaticMarkup(
      createElement(SupportingEvidencePanel, {
        courseTitle: "Master of Business Administration (Government)",
        ensureApplicationRow: async () => "application-id",
        isHero: false,
        isProcessing: false,
        onNavigate: () => undefined,
        onSaveFeedback: async () => undefined,
        onSkipPrompt: () => undefined,
        onUnskipPrompt: () => undefined,
        plan,
        showParsedTranscriptIntro: false,
        ungroupedRows: rows,
      }),
    );

    expect(html.match(/eligibility-evidence-field/g)).toHaveLength(2);
    expect(html).toContain("--eligibility-evidence-reveal-order:0");
    expect(html).toContain("--eligibility-evidence-reveal-order:1");
  });

  it("keeps an advisory work-experience result in the compact green evidence list", () => {
    const workRow: ProgramEvidenceRow = {
      explanation:
        "Your CV indicates 3 years of relevant experience. Admissions will confirm relevance and duration.",
      heading: "Relevant Work Experience",
      id: "work-1",
      isBlocking: false,
      kindLabel: "Work experience",
      requirementId: "work-1",
      sourceText: "Three years relevant work experience.",
      status: "provisionally_met",
      statusLabel: "Appears to meet",
    };
    const readyPlan: Section2EvidencePlan = {
      ...plan,
      isEvidenceReady: true,
      nextPrompt: null,
      remainingPromptCount: 0,
    };

    const html = renderToStaticMarkup(
      createElement(SupportingEvidencePanel, {
        courseTitle: "Course",
        ensureApplicationRow: async () => "application-id",
        isHero: false,
        isProcessing: false,
        onNavigate: () => undefined,
        onSaveFeedback: async () => undefined,
        onSkipPrompt: () => undefined,
        onUnskipPrompt: () => undefined,
        plan: readyPlan,
        showParsedTranscriptIntro: false,
        ungroupedRows: [workRow],
      }),
    );

    expect(html).toContain('aria-label="Evidence satisfied"');
    expect(html).toContain("Appears to meet");
    expect(html).toContain("Evidence ready");
    expect(html).not.toContain('aria-label="Evidence needing review"');
  });

  it("shows a review outcome and the failed academic check instead of evidence ready", () => {
    const assessment = normalizeTranscriptEligibilityAssessment({
      checkedAt: "2026-07-15T00:00:00Z",
      outcome: "ineligible",
      requirementsChecked: [],
      selectedPathwayId: "mba-level-1",
    });

    const html = renderToStaticMarkup(
      createElement(SupportingEvidencePanel, {
        assessment,
        courseCode: "master-of-business-administration-digital",
        courseTitle: "Master of Business Administration (Digital)",
        ensureApplicationRow: async () => "application-id",
        isHero: false,
        isProcessing: false,
        onNavigate: () => undefined,
        onSaveFeedback: async () => undefined,
        onSkipPrompt: () => undefined,
        onUnskipPrompt: () => undefined,
        plan,
        showParsedTranscriptIntro: true,
        ungroupedRows: rows,
      }),
    );

    expect(html).toContain("Needs review");
    expect(html).not.toContain("Evidence ready");
    expect(html).toContain("Minimum WAM 60");
    expect(html).toContain("Your WAM of 59.0 is below the minimum of 60");
  });

  it("does not show completion as a separate card when the level requirement includes it", () => {
    const assessment = normalizeTranscriptEligibilityAssessment({
      checkedAt: "2026-07-15T00:00:00Z",
      extractedData: {
        studyDetails: {
          completionStatus: {
            confidence: 0.99,
            normalizedValue: "conferred",
            originalValue: "Award conferred",
          },
        },
      },
      outcome: "eligible",
      requirementsChecked: [],
      selectedPathwayId: "mba-level-1",
    });

    const html = renderToStaticMarkup(
      createElement(SupportingEvidencePanel, {
        assessment,
        courseCode: "master-of-business-administration-digital",
        courseTitle: "Master of Business Administration (Digital)",
        ensureApplicationRow: async () => "application-id",
        isHero: false,
        isProcessing: false,
        onNavigate: () => undefined,
        onSaveFeedback: async () => undefined,
        onSkipPrompt: () => undefined,
        onUnskipPrompt: () => undefined,
        plan,
        showParsedTranscriptIntro: true,
        ungroupedRows: [rows[0]],
      }),
    );

    expect(html).toContain("Bachelor degree or higher");
    expect(html).toContain("Met");
    expect(html).not.toContain("Qualification completion from transcript");
    expect(html).not.toContain("Completion status: conferred");
  });

  it("omits extracted WAM and GPA when the course publishes no academic threshold", () => {
    const assessment = normalizeTranscriptEligibilityAssessment({
      checkedAt: "2026-07-22T00:00:00Z",
      extractedData: {
        academicPerformance: {
          gpa: {
            confidence: 0.99,
            normalizedValue: "3.3",
            originalValue: "3.3",
          },
          gpaScale: {
            confidence: 0.99,
            normalizedValue: "4.0",
            originalValue: "4.0",
          },
          gradeAverageOrWam: {
            confidence: 0.99,
            normalizedValue: "74.2",
            originalValue: "74.2",
          },
        },
      },
      outcome: "eligible",
      requirementsChecked: [],
      selectedPathwayId: "related-bachelor",
    });
    const readyPlan: Section2EvidencePlan = {
      ...plan,
      isEvidenceReady: true,
      nextPrompt: null,
      remainingPromptCount: 0,
    };

    const html = renderToStaticMarkup(
      createElement(SupportingEvidencePanel, {
        assessment,
        courseTitle: "Master of Business Administration (Government)",
        ensureApplicationRow: async () => "application-id",
        isHero: false,
        isProcessing: false,
        onNavigate: () => undefined,
        onSaveFeedback: async () => undefined,
        onSkipPrompt: () => undefined,
        onUnskipPrompt: () => undefined,
        plan: readyPlan,
        showParsedTranscriptIntro: true,
        ungroupedRows: [rows[0]],
      }),
    );

    expect(html).not.toContain("Academic result from transcript");
    expect(html).not.toContain("WAM: 74.2");
    expect(html).not.toContain("GPA: 3.3/4.0");
    expect(html).toContain("Bachelor degree or higher");
  });
});
