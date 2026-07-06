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

  it("drops single-member alternative groups so they do not gate eligibility", () => {
    // The parser is instructed to skip ad-hoc entry pathways that cannot be expressed as a genuine
    // multi-member OR. Defense-in-depth in the matcher: if a single-member alternative group leaks
    // through, drop it rather than render it as a 1-OR that can fail and tank the overall outcome.
    const instances: RequirementInstance[] = [
      {
        id: "completed-bachelor",
        kind: "qualification_completed",
        params: {},
        sourceText: "Successful completion of a bachelor degree.",
        weight: "mandatory",
      },
      {
        id: "professional-entry-8y",
        kind: "work_experience",
        params: { minYears: 8 },
        sourceText: "Applicants without a degree may be considered with 8 years experience.",
        weight: "alternative",
        alternativeGroupId: "professional-entry",
      },
    ];
    const evidence: TranscriptExtractedData = {
      studyDetails: {
        completionStatus: { confidence: 0.9, normalizedValue: "completed" },
      },
    };

    const checks = evaluateRequirements(instances, evidence, emptyContext());

    expect(checks).toHaveLength(1);
    expect(checks[0].id).toBe("completed-bachelor");
    expect(checks[0].status).toBe("pass");
  });

  it("does NOT fold mandatory requirements that happen to share an alternativeGroupId", () => {
    // Defense-in-depth: a parser bug or hand-edited fixture could attach an alternativeGroupId to
    // mandatory items. Those must still render as standalone checks rather than collapsing into a
    // single OR-pass when any one of them is satisfied.
    const instances: RequirementInstance[] = [
      {
        id: "completed-bachelor",
        kind: "qualification_completed",
        params: {},
        sourceText: "Successful completion of an Australian bachelor degree.",
        weight: "mandatory",
        alternativeGroupId: "academic-entry",
      },
      {
        id: "wam-60",
        kind: "academic_threshold",
        params: { metric: "wam", min: 60 },
        sourceText: "WAM 60% or above.",
        weight: "mandatory",
        alternativeGroupId: "academic-entry",
      },
    ];
    const evidence: TranscriptExtractedData = {
      studyDetails: {
        completionStatus: { confidence: 0.9, normalizedValue: "completed" },
      },
      academicPerformance: {
        gradeAverageOrWam: { confidence: 0.9, normalizedValue: "45" },
      },
    };

    const checks = evaluateRequirements(instances, evidence, emptyContext());

    expect(checks).toHaveLength(2);
    const statuses = checks.map((check) => check.status).sort();
    expect(statuses).toEqual(["fail", "pass"]);
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

  it("academic_threshold calculates WAM from counted unit marks before using GPA fallback", () => {
    const instances: RequirementInstance[] = [
      {
        id: "wam",
        kind: "academic_threshold",
        params: { metric: "wam", min: 60 },
        sourceText: "WAM 60% or above.",
        weight: "mandatory",
      },
    ];
    const evidence: TranscriptExtractedData = {
      academicPerformance: {
        gpa: { confidence: 0.9, normalizedValue: "5.25" },
        gpaScale: { confidence: 0.9, normalizedValue: "7" },
        unitResults: [
          { counted: true, creditPoints: 10, grade: "D", mark: 71 },
          { counted: true, creditPoints: 10, grade: "Cr", mark: 66 },
          { counted: true, creditPoints: 10, grade: "P", mark: 58 },
          { counted: true, creditPoints: 10, grade: "S" },
          { counted: true, creditPoints: 10, grade: "F", mark: 41 },
          { counted: true, creditPoints: 10, grade: "W" },
        ],
      },
    };

    const [check] = evaluateRequirements(instances, evidence, emptyContext());

    expect(check.status).toBe("fail");
    expect(check.reasonCode).toBe("WAM_BELOW");
    expect(check.details).toMatchObject({
      metric: "wam",
      observed: "59.0",
      required: "60",
    });
    expect(check.explanation).toContain("Calculated WAM 59.0");
  });

  it("prefers calculated unit WAM over a conflicting extracted aggregate", () => {
    const instances: RequirementInstance[] = [
      {
        id: "wam",
        kind: "academic_threshold",
        params: { metric: "wam", min: 60 },
        sourceText: "WAM 60% or above.",
        weight: "mandatory",
      },
    ];
    const evidence: TranscriptExtractedData = {
      academicPerformance: {
        gradeAverageOrWam: { confidence: 0.9, normalizedValue: "65" },
        unitResults: [
          { counted: true, creditPoints: 10, grade: "D", mark: 71 },
          { counted: true, creditPoints: 10, grade: "Cr", mark: 66 },
          { counted: true, creditPoints: 10, grade: "P", mark: 58 },
          { counted: true, creditPoints: 10, grade: "F", mark: 41 },
        ],
      },
    };

    const [check] = evaluateRequirements(instances, evidence, emptyContext());

    expect(check.status).toBe("fail");
    expect(check.details).toMatchObject({ observed: "59.0", required: "60" });
  });

  it("treats graduate certificate as bachelor-or-higher for qualification_level", () => {
    const instances: RequirementInstance[] = [
      {
        id: "level-bachelor",
        kind: "qualification_level",
        params: { level: "bachelor" },
        sourceText: "Australian bachelor degree or equivalent.",
        weight: "mandatory",
      },
    ];
    const evidence: TranscriptExtractedData = {
      studyDetails: {
        highestEducationLevel: {
          confidence: 0.9,
          normalizedValue: "Graduate Certificate of Business",
        },
      },
    };

    const [check] = evaluateRequirements(instances, evidence, emptyContext());

    expect(check.status).toBe("pass");
    expect(check.reasonCode).toBe("QUALIFICATION_LEVEL_MET");
  });

  it("suppresses unsatisfied pathway bundles when another pathway is fully met", () => {
    const instances: RequirementInstance[] = [
      {
        id: "level1-qual",
        kind: "qualification_level",
        params: { level: "bachelor" },
        sourceText: "Entry Level 1: bachelor or equivalent with 60% average.",
        weight: "mandatory",
        pathwayBundleId: "level-1",
      },
      {
        id: "level1-wam",
        kind: "academic_threshold",
        params: { metric: "wam", min: 60 },
        sourceText: "Entry Level 1: bachelor or equivalent with 60% average.",
        weight: "mandatory",
        pathwayBundleId: "level-1",
      },
      {
        id: "level2-completion",
        kind: "qualification_completed",
        params: {},
        sourceText: "Entry Level 2: Monash graduate certificate with 60% average.",
        weight: "mandatory",
        pathwayBundleId: "level-2",
      },
      {
        id: "level2-wam",
        kind: "academic_threshold",
        params: { metric: "wam", min: 60 },
        sourceText: "Entry Level 2: Monash graduate certificate with 60% average.",
        weight: "mandatory",
        pathwayBundleId: "level-2",
      },
    ];
    const evidence: TranscriptExtractedData = {
      studyDetails: {
        completionStatus: { confidence: 0.9, normalizedValue: "completed" },
        highestEducationLevel: {
          confidence: 0.9,
          normalizedValue: "Graduate Certificate of Business",
        },
      },
      academicPerformance: {
        gradeAverageOrWam: { confidence: 0.9, normalizedValue: "72" },
      },
    };

    const checks = evaluateRequirements(instances, evidence, emptyContext());

    expect(checks.map((check) => check.id).sort()).toEqual([
      "level1-qual",
      "level1-wam",
      "level2-completion",
      "level2-wam",
    ]);
    expect(aggregateOutcome(checks)).toEqual({
      outcome: "eligible",
      manualReviewRequired: false,
    });
  });

  it("drops unsatisfied pathway bundles when another pathway has no failing checks", () => {
    const instances: RequirementInstance[] = [
      {
        id: "level1-qual",
        kind: "qualification_level",
        params: { level: "bachelor" },
        sourceText: "Entry Level 1: bachelor or equivalent with 60% average.",
        weight: "mandatory",
        pathwayBundleId: "level-1",
      },
      {
        id: "level1-wam",
        kind: "academic_threshold",
        params: { metric: "wam", min: 60 },
        sourceText: "Entry Level 1: bachelor or equivalent with 60% average.",
        weight: "mandatory",
        pathwayBundleId: "level-1",
      },
      {
        id: "level2-completion",
        kind: "qualification_completed",
        params: {},
        sourceText: "Entry Level 2: Monash graduate certificate with 80% average.",
        weight: "mandatory",
        pathwayBundleId: "level-2",
      },
      {
        id: "level2-wam",
        kind: "academic_threshold",
        params: { metric: "wam", min: 80 },
        sourceText: "Entry Level 2: Monash graduate certificate with 80% average.",
        weight: "mandatory",
        pathwayBundleId: "level-2",
      },
    ];
    const evidence: TranscriptExtractedData = {
      studyDetails: {
        completionStatus: { confidence: 0.9, normalizedValue: "completed" },
        highestEducationLevel: {
          confidence: 0.9,
          normalizedValue: "Graduate Certificate of Business",
        },
      },
      academicPerformance: {
        gradeAverageOrWam: { confidence: 0.9, normalizedValue: "72" },
      },
    };

    const checks = evaluateRequirements(instances, evidence, emptyContext());

    expect(checks.map((check) => check.id).sort()).toEqual(["level1-qual", "level1-wam"]);
    expect(aggregateOutcome(checks)).toEqual({
      outcome: "eligible",
      manualReviewRequired: false,
    });
  });
});

describe("conditional requirements end-to-end", () => {
  it("a failed conditional requirement yields conditionally_eligible", () => {
    const instances: RequirementInstance[] = [
      {
        id: "completion",
        kind: "qualification_completed",
        params: {},
        sourceText: "Completed bachelor degree.",
        weight: "mandatory",
      },
      {
        id: "field",
        kind: "field_of_study",
        params: { acceptedAreas: ["business"] },
        sourceText: "Preferably a business background.",
        weight: "conditional",
      },
    ];
    const evidence: TranscriptExtractedData = {
      studyDetails: {
        completionStatus: { confidence: 1, normalizedValue: "completed" },
        programName: { confidence: 1, normalizedValue: "Bachelor of Arts" },
      },
    };

    const checks = evaluateRequirements(instances, evidence, emptyContext());
    const conditionalIds = new Set(
      instances.filter((i) => i.weight === "conditional").map((i) => i.id),
    );

    expect(checks.find((c) => c.id === "field")?.status).toBe("fail");
    expect(aggregateOutcome(checks, { conditionalIds })).toEqual({
      outcome: "conditionally_eligible",
      manualReviewRequired: true,
    });
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

  it("returns conditionally_eligible when only conditional requirements fail", () => {
    expect(
      aggregateOutcome(
        [
          { id: "a", requirement: "A", status: "pass", explanation: "" },
          { id: "cond", requirement: "Cond", status: "fail", explanation: "" },
        ],
        { conditionalIds: new Set(["cond"]) },
      ),
    ).toEqual({ outcome: "conditionally_eligible", manualReviewRequired: true });
  });

  it("conditional failure does not override a hard (mandatory) failure", () => {
    expect(
      aggregateOutcome(
        [
          { id: "mand", requirement: "M", status: "fail", explanation: "" },
          { id: "cond", requirement: "Cond", status: "fail", explanation: "" },
        ],
        { conditionalIds: new Set(["cond"]) },
      ),
    ).toEqual({ outcome: "ineligible", manualReviewRequired: false });
  });

  it("conditional failure outranks unknowns", () => {
    expect(
      aggregateOutcome(
        [
          { id: "cond", requirement: "Cond", status: "fail", explanation: "" },
          { id: "u", requirement: "U", status: "unknown", explanation: "" },
        ],
        { conditionalIds: new Set(["cond"]) },
      ),
    ).toEqual({ outcome: "conditionally_eligible", manualReviewRequired: true });
  });

  it("without conditionalIds, every failure is hard (unchanged behavior)", () => {
    expect(
      aggregateOutcome([
        { id: "cond", requirement: "Cond", status: "fail", explanation: "" },
      ]),
    ).toEqual({ outcome: "ineligible", manualReviewRequired: false });
  });
});
