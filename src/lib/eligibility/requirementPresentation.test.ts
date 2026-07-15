import { describe, expect, it } from "vitest";
import type { RequirementInstance } from "./requirements";
import {
  BACHELOR_QUALIFICATION_DETAIL_TEXT,
  consolidatePairedQualificationRequirements,
  formatRequirementDetailText,
  shouldOmitPairedQualificationCompleted,
} from "./requirementPresentation";

const bachelorPair: RequirementInstance[] = [
  {
    id: "completed-bachelor",
    kind: "qualification_completed",
    params: {},
    sourceText:
      "Completion of an Australian university 3-year bachelor degree (AQF Level 7 or recognised equivalent)",
    weight: "mandatory",
  },
  {
    id: "level-bachelor",
    kind: "qualification_level",
    params: { level: "bachelor" },
    sourceText:
      "Completion of an Australian university 3-year bachelor degree (AQF Level 7 or recognised equivalent)",
    weight: "mandatory",
  },
];

describe("requirementPresentation", () => {
  it("omits paired qualification_completed requirements from display lists", () => {
    expect(shouldOmitPairedQualificationCompleted(bachelorPair, bachelorPair[0])).toBe(true);
    expect(shouldOmitPairedQualificationCompleted(bachelorPair, bachelorPair[1])).toBe(false);
  });

  it("consolidates paired bachelor requirements into a single level requirement", () => {
    const consolidated = consolidatePairedQualificationRequirements(bachelorPair);

    expect(consolidated).toHaveLength(1);
    expect(consolidated[0]).toMatchObject({
      id: "level-bachelor",
      kind: "qualification_level",
      params: { completedRequired: true, level: "bachelor" },
      sourceText: BACHELOR_QUALIFICATION_DETAIL_TEXT,
    });
  });

  it("derives requirement-specific detail text from shared compound source sentences", () => {
    const sharedSource =
      "Entry Level 1: An Australian bachelor degree or equivalent qualification with at least a credit (60%) average, or equivalent Grade Point Average (GPA) and three years relevant experience in a professional role.";
    const siblings: RequirementInstance[] = [
      {
        id: "level",
        kind: "qualification_level",
        params: { level: "bachelor" },
        sourceText: sharedSource,
        weight: "mandatory",
      },
      {
        id: "wam",
        kind: "academic_threshold",
        params: { metric: "wam", min: 60, scale: 100 },
        sourceText: sharedSource,
        weight: "mandatory",
      },
      {
        id: "experience",
        kind: "work_experience",
        params: { minYears: 3, relevantTo: "professional role" },
        sourceText: sharedSource,
        weight: "alternative",
        alternativeGroupId: "level1-entry-acad-min",
      },
    ];

    expect(formatRequirementDetailText(siblings[0], siblings)).toBe(
      "An Australian bachelor degree or equivalent qualification",
    );
    expect(formatRequirementDetailText(siblings[1], siblings)).toBe(
      "At least a credit (60%) average, or equivalent Grade Point Average (GPA)",
    );
    expect(formatRequirementDetailText(siblings[2], siblings)).toBe(
      "At least 3 year(s) relevant experience in a professional role",
    );
  });
});
