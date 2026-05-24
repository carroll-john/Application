import { describe, expect, it } from "vitest";
import { aggregateOutcome, evaluateRequirements } from "./matcher";
import type { RequirementInstance } from "./requirements";
import type { TranscriptEligibilityRequestContext, TranscriptExtractedData } from "./types";

function emptyContext(): TranscriptEligibilityRequestContext {
  return {};
}

describe("evaluateRequirements", () => {
  it("emits one check per requirement, in input order", () => {
    const instances: RequirementInstance[] = [
      {
        id: "completion",
        kind: "qualification_completed",
        params: {},
        sourceText: "Successful completion of an Australian bachelor degree.",
        weight: "mandatory",
      },
      {
        id: "wam",
        kind: "academic_threshold",
        params: { metric: "wam", min: 65 },
        sourceText: "Weighted Average Mark of 65% or above.",
        weight: "mandatory",
      },
    ];
    const evidence: TranscriptExtractedData = {
      studyDetails: {
        completionStatus: { confidence: 0.9, normalizedValue: "completed" },
      },
      academicPerformance: {
        gradeAverageOrWam: { confidence: 0.9, normalizedValue: "72" },
      },
    };

    const checks = evaluateRequirements(instances, evidence, emptyContext());

    expect(checks).toHaveLength(2);
    expect(checks[0].id).toBe("completion");
    expect(checks[0].status).toBe("pass");
    expect(checks[1].id).toBe("wam");
    expect(checks[1].status).toBe("pass");
  });

  it("returns english_proficiency pass when applicant country is in accepted list", () => {
    const instances: RequirementInstance[] = [
      {
        id: "english",
        kind: "english_proficiency",
        params: {
          acceptedPathways: [
            { type: "completion_in_country", countries: ["AU", "NZ", "UK"] },
          ],
        },
        sourceText:
          "Evidence of English language proficiency or completion of program in English.",
        weight: "mandatory",
      },
    ];
    const evidence: TranscriptExtractedData = {
      applicantDetails: {
        countryOfInstitution: { confidence: 0.9, normalizedValue: "Australia" },
      },
    };

    const [check] = evaluateRequirements(instances, evidence, emptyContext());

    expect(check.status).toBe("pass");
    expect(check.id).toBe("english");
  });

  it("returns english_proficiency unknown for countries not on accepted list", () => {
    const instances: RequirementInstance[] = [
      {
        id: "english",
        kind: "english_proficiency",
        params: {
          acceptedPathways: [
            { type: "completion_in_country", countries: ["AU", "NZ", "UK"] },
          ],
        },
        sourceText: "Evidence of English language proficiency.",
        weight: "mandatory",
      },
    ];
    const evidence: TranscriptExtractedData = {
      applicantDetails: {
        countryOfInstitution: { confidence: 0.9, normalizedValue: "Indonesia" },
      },
    };

    const [check] = evaluateRequirements(instances, evidence, emptyContext());

    expect(check.status).toBe("unknown");
  });

  it("folds alternative-group requirements into a single OR-check", () => {
    const instances: RequirementInstance[] = [
      {
        id: "level-bachelor",
        kind: "qualification_level",
        params: { level: "bachelor" },
        sourceText: "A completed bachelor degree.",
        weight: "alternative",
        alternativeGroupId: "academic-entry",
      },
      {
        id: "experience-5y",
        kind: "work_experience",
        params: { minYears: 5 },
        sourceText: "Five or more years of relevant professional experience.",
        weight: "alternative",
        alternativeGroupId: "academic-entry",
      },
    ];
    const evidence: TranscriptExtractedData = {
      studyDetails: {
        highestEducationLevel: { confidence: 0.9, normalizedValue: "Bachelor of IT" },
      },
    };

    const checks = evaluateRequirements(instances, evidence, emptyContext());

    expect(checks).toHaveLength(1);
    expect(checks[0].status).toBe("pass");
    expect(checks[0].requirement).toContain("OR");
  });

  it("alternative group falls back to unknown when no member passes but some are unknown", () => {
    const instances: RequirementInstance[] = [
      {
        id: "level-bachelor",
        kind: "qualification_level",
        params: { level: "bachelor" },
        sourceText: "A completed bachelor degree.",
        weight: "alternative",
        alternativeGroupId: "entry",
      },
      {
        id: "experience-3y",
        kind: "work_experience",
        params: { minYears: 3 },
        sourceText: "Three or more years of relevant professional experience.",
        weight: "alternative",
        alternativeGroupId: "entry",
      },
    ];
    const evidence: TranscriptExtractedData = {};

    const [check] = evaluateRequirements(instances, evidence, emptyContext());

    expect(check.status).toBe("unknown");
  });

  it("alternative group fails when every member fails", () => {
    const instances: RequirementInstance[] = [
      {
        id: "level-masters",
        kind: "qualification_level",
        params: { level: "masters" },
        sourceText: "A completed masters degree.",
        weight: "alternative",
        alternativeGroupId: "entry",
      },
      {
        id: "field",
        kind: "field_of_study",
        params: { acceptedAreas: ["medicine", "nursing"] },
        sourceText: "Prior study in a clinical health field.",
        weight: "alternative",
        alternativeGroupId: "entry",
      },
    ];
    const evidence: TranscriptExtractedData = {
      studyDetails: {
        highestEducationLevel: { confidence: 0.9, normalizedValue: "Bachelor of IT" },
        programName: { confidence: 0.9, normalizedValue: "Bachelor of Information Technology" },
      },
    };

    const [check] = evaluateRequirements(instances, evidence, emptyContext());

    expect(check.status).toBe("fail");
  });

  it("academic_threshold maps GPA to WAM when WAM is missing", () => {
    const instances: RequirementInstance[] = [
      {
        id: "wam",
        kind: "academic_threshold",
        params: { metric: "wam", min: 65 },
        sourceText: "WAM 65% or above.",
        weight: "mandatory",
      },
    ];
    const evidence: TranscriptExtractedData = {
      academicPerformance: {
        gpa: { confidence: 0.9, normalizedValue: "6.1" },
        gpaScale: { confidence: 0.9, normalizedValue: "7" },
      },
    };

    const [check] = evaluateRequirements(instances, evidence, emptyContext());

    expect(check.status).toBe("pass");
    expect(check.explanation).toContain("Mapped GPA");
  });
});

describe("aggregateOutcome", () => {
  it("returns eligible when all checks pass", () => {
    expect(
      aggregateOutcome([
        { id: "a", requirement: "A", status: "pass", explanation: "" },
        { id: "b", requirement: "B", status: "pass", explanation: "" },
      ]),
    ).toEqual({ outcome: "eligible", manualReviewRequired: false });
  });

  it("returns ineligible when any check fails", () => {
    expect(
      aggregateOutcome([
        { id: "a", requirement: "A", status: "pass", explanation: "" },
        { id: "b", requirement: "B", status: "fail", explanation: "" },
        { id: "c", requirement: "C", status: "unknown", explanation: "" },
      ]),
    ).toEqual({ outcome: "ineligible", manualReviewRequired: false });
  });

  it("returns insufficient_data when checks pass-or-unknown only", () => {
    expect(
      aggregateOutcome([
        { id: "a", requirement: "A", status: "pass", explanation: "" },
        { id: "b", requirement: "B", status: "unknown", explanation: "" },
      ]),
    ).toEqual({ outcome: "insufficient_data", manualReviewRequired: true });
  });
});
