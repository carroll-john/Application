import { describe, expect, it } from "vitest";
import { applyDeterministicEligibilityRules } from "./deterministicRules";

describe("applyDeterministicEligibilityRules", () => {
  it("passes WAM threshold when transcript evidence meets minimum", () => {
    const result = applyDeterministicEligibilityRules(
      {
        outcome: "eligible",
        requirementsChecked: [],
        academicPerformance: {
          gradeAverageOrWam: {
            confidence: 0.9,
            missingOrAmbiguous: false,
            normalizedValue: "72",
            originalValue: "WAM 72",
          },
        },
        studyDetails: {
          completionStatus: {
            confidence: 0.9,
            missingOrAmbiguous: false,
            normalizedValue: "completed",
            originalValue: "completed",
          },
        },
      },
      {
        completed: true,
        minWam: 65,
      },
    );

    expect(result.outcome).toBe("eligible");
    expect(
      (result.requirementsChecked as Array<{ id: string; status: string }>).find(
        (check) => check.id === "deterministic-wam-gpa-threshold",
      )?.status,
    ).toBe("pass");
  });

  it("fails WAM threshold when transcript evidence is below minimum", () => {
    const result = applyDeterministicEligibilityRules(
      {
        outcome: "eligible",
        requirementsChecked: [],
        academicPerformance: {
          gradeAverageOrWam: {
            confidence: 0.9,
            missingOrAmbiguous: false,
            normalizedValue: "58",
            originalValue: "WAM 58",
          },
        },
        studyDetails: {
          completionStatus: {
            confidence: 0.9,
            missingOrAmbiguous: false,
            normalizedValue: "completed",
            originalValue: "completed",
          },
        },
      },
      {
        completed: true,
        minWam: 65,
      },
    );

    expect(result.outcome).toBe("ineligible");
    expect(
      (result.requirementsChecked as Array<{ id: string; status: string }>).find(
        (check) => check.id === "deterministic-wam-gpa-threshold",
      )?.status,
    ).toBe("fail");
  });

  it("adds guarded English inference for Australian institutions", () => {
    const result = applyDeterministicEligibilityRules(
      {
        outcome: "eligible",
        requirementsChecked: [],
        applicantDetails: {
          institutionName: {
            confidence: 0.8,
            missingOrAmbiguous: false,
            normalizedValue: "The University of Melbourne",
            originalValue: "The University of Melbourne",
          },
          countryOfInstitution: {
            confidence: 0.8,
            missingOrAmbiguous: false,
            normalizedValue: "Australia",
            originalValue: "Australia",
          },
        },
        studyDetails: {
          completionStatus: {
            confidence: 0.9,
            missingOrAmbiguous: false,
            normalizedValue: "completed",
            originalValue: "completed",
          },
        },
      },
      {
        completed: true,
      },
    );

    expect(result.manualReviewRequired).toBe(true);
    expect(result.outcome).toBe("conditionally_eligible");
    expect(
      (result.englishLanguageEvidence as Record<string, { normalizedValue?: string }>)
        .englishInstructionEvidence?.normalizedValue,
    ).toBe("likely_english_instruction_au_institution");
  });

  it("uses existing transcript threshold checks when numeric fields are missing", () => {
    const result = applyDeterministicEligibilityRules(
      {
        outcome: "eligible",
        requirementsChecked: [
          {
            id: "minWam",
            requirement: "Applicant must have a WAM of 65% or above.",
            status: "pass",
            explanation: "Transcript shows a WAM of 78.6, above threshold.",
          },
        ],
        studyDetails: {
          completionStatus: {
            confidence: 0.9,
            missingOrAmbiguous: false,
            normalizedValue: "completed",
            originalValue: "completed",
          },
        },
      },
      {
        completed: true,
        minWam: 65,
      },
    );

    const thresholdCheck = (
      result.requirementsChecked as Array<{
        id: string;
        status: string;
        explanation: string;
      }>
    ).find((check) => check.id === "deterministic-wam-gpa-threshold");

    expect(result.outcome).toBe("eligible");
    expect(thresholdCheck?.status).toBe("pass");
    expect(thresholdCheck?.explanation).toContain("Structured transcript check indicates pass");
  });
});
