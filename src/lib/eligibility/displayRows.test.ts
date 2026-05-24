import { describe, expect, it } from "vitest";
import { buildEligibilityDisplayRows } from "./displayRows";
import type { RequirementInstance } from "./requirements";

describe("buildEligibilityDisplayRows", () => {
  it("falls back to raw checks when no canonical requirements are supplied", () => {
    const rows = buildEligibilityDisplayRows(undefined, [
      {
        id: "deterministic-completion",
        requirement: "Completed qualification requirement",
        status: "pass",
        explanation: "Qualification appears completed.",
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "deterministic-completion",
      sourceText: "Completed qualification requirement",
      kindLabel: "",
      status: "pass",
    });
  });

  it("joins each canonical requirement to its check by id", () => {
    const requirements: RequirementInstance[] = [
      {
        id: "completion",
        kind: "qualification_completed",
        params: {},
        sourceText: "Successful completion of an Australian bachelor degree.",
        weight: "mandatory",
      },
      {
        id: "wam-65",
        kind: "academic_threshold",
        params: { metric: "wam", min: 65 },
        sourceText: "WAM 65% or above.",
        weight: "mandatory",
      },
    ];

    const rows = buildEligibilityDisplayRows(requirements, [
      {
        id: "completion",
        requirement: "Successful completion of an Australian bachelor degree.",
        status: "pass",
        explanation: "Qualification appears completed.",
      },
      {
        id: "wam-65",
        requirement: "WAM 65% or above.",
        status: "pass",
        explanation: "WAM 78.6 meets minimum WAM 65.",
      },
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe("completion");
    expect(rows[0].status).toBe("pass");
    expect(rows[0].kindLabel).toBe("Completed qualification");
    expect(rows[1].id).toBe("wam-65");
    expect(rows[1].kindLabel).toBe("Academic results threshold");
  });

  it("emits 'Not evaluated automatically' for requirements with no matching check", () => {
    const requirements: RequirementInstance[] = [
      {
        id: "work-exp-5y",
        kind: "work_experience",
        params: { minYears: 5 },
        sourceText: "Five years of relevant professional experience.",
        weight: "mandatory",
      },
    ];

    const [row] = buildEligibilityDisplayRows(requirements, []);

    expect(row.status).toBe("unknown");
    expect(row.explanation).toContain("Not evaluated automatically");
  });

  it("folds completion and level requirements with the same source text into one row", () => {
    const requirements: RequirementInstance[] = [
      {
        id: "completed-bachelor",
        kind: "qualification_completed",
        params: {},
        sourceText: "Successful completion of an Australian bachelor degree (or equivalent).",
        weight: "mandatory",
      },
      {
        id: "completed-australian-bachelor",
        kind: "qualification_level",
        params: { level: "bachelor" },
        sourceText: "Successful completion of an Australian bachelor degree (or equivalent).",
        weight: "mandatory",
      },
      {
        id: "english-completion-in-country",
        kind: "english_proficiency",
        params: {
          acceptedPathways: [{ type: "completion_in_country", countries: ["AU"] }],
        },
        sourceText: "English language proficiency satisfied by completion in Australia.",
        weight: "mandatory",
      },
    ];

    const rows = buildEligibilityDisplayRows(requirements, [
      {
        id: "completed-bachelor",
        requirement: "Successful completion of an Australian bachelor degree (or equivalent).",
        status: "pass",
        explanation: "Qualification appears completed based on supplied evidence.",
      },
      {
        id: "completed-australian-bachelor",
        requirement: "Successful completion of an Australian bachelor degree (or equivalent).",
        status: "pass",
        explanation: 'Extracted level "Bachelor degree" meets the required bachelor level.',
      },
      {
        id: "english-completion-in-country",
        requirement: "English language proficiency satisfied by completion in Australia.",
        status: "pass",
        explanation: "English language proficiency satisfied by completion at an institution in Australia.",
      },
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: "completed-bachelor",
      kindLabel: "Completed qualification",
      status: "pass",
      explanation:
        'Qualification appears completed based on supplied evidence. Extracted level "Bachelor degree" meets the required bachelor level.',
    });
    expect(rows[1].id).toBe("english-completion-in-country");
  });

  it("folds alternative-group requirements into a single row", () => {
    const requirements: RequirementInstance[] = [
      {
        id: "bachelor",
        kind: "qualification_level",
        params: { level: "bachelor" },
        sourceText: "A completed bachelor degree.",
        weight: "alternative",
        alternativeGroupId: "entry",
      },
      {
        id: "experience",
        kind: "work_experience",
        params: { minYears: 5 },
        sourceText: "Or five years of professional experience.",
        weight: "alternative",
        alternativeGroupId: "entry",
      },
    ];

    const rows = buildEligibilityDisplayRows(requirements, [
      {
        id: "entry:satisfied",
        requirement: "A completed bachelor degree. — OR — Or five years of professional experience.",
        status: "pass",
        explanation: "One alternative satisfied.",
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("entry");
    expect(rows[0].status).toBe("pass");
  });
});
