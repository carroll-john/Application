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
});
