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

  it("passes English proficiency for Australian institutions completed in Australia", () => {
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

    const englishCheck = (
      result.requirementsChecked as Array<{ id: string; status: string }>
    ).find((check) => check.id === "deterministic-english-proficiency");

    expect(result.outcome).toBe("eligible");
    expect(result.manualReviewRequired).toBe(false);
    expect(englishCheck?.status).toBe("pass");
    expect(
      (result.englishLanguageEvidence as Record<string, { normalizedValue?: string }>)
        .englishInstructionEvidence?.normalizedValue,
    ).toBe("english_instruction_au_institution");
  });

  it("marks WAM threshold unknown when no numeric WAM/GPA evidence is extracted", () => {
    const result = applyDeterministicEligibilityRules(
      {
        outcome: "eligible",
        requirementsChecked: [],
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
      }>
    ).find((check) => check.id === "deterministic-wam-gpa-threshold");

    expect(result.outcome).toBe("insufficient_data");
    expect(thresholdCheck?.status).toBe("unknown");
  });

  it("derives the verdict from the checks, ignoring a contradicting upstream outcome", () => {
    const result = applyDeterministicEligibilityRules(
      {
        // Upstream LLM verdict fields that contradict the evidence below
        manualReviewRequired: true,
        outcome: "insufficient_data",
        requirementsChecked: [],
        applicantDetails: {
          countryOfInstitution: {
            confidence: 0.9,
            missingOrAmbiguous: false,
            normalizedValue: "Australia",
            originalValue: "Australia",
          },
          institutionName: {
            confidence: 0.9,
            missingOrAmbiguous: false,
            normalizedValue: "The University of Melbourne",
            originalValue: "The University of Melbourne",
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
      { completed: true },
    );

    const statuses = (result.requirementsChecked as Array<{ status: string }>).map(
      (check) => check.status,
    );
    expect(statuses.every((status) => status === "pass")).toBe(true);
    expect(result.outcome).toBe("eligible");
    expect(result.manualReviewRequired).toBe(false);
  });

  it("emits exactly one deterministic check per applicable rule with no duplicates", () => {
    const result = applyDeterministicEligibilityRules(
      {
        outcome: "eligible",
        requirementsChecked: [
          {
            id: "legacy-llm-completion-check",
            requirement: "Successful completion of an Australian bachelor degree.",
            status: "pass",
            explanation: "Transcript shows completed Bachelor of IT.",
          },
          {
            id: "legacy-llm-wam-check",
            requirement: "WAM 65% or above.",
            status: "pass",
            explanation: "Transcript reports WAM 78.6.",
          },
        ],
        applicantDetails: {
          institutionName: {
            confidence: 0.9,
            missingOrAmbiguous: false,
            normalizedValue: "The University of Melbourne",
            originalValue: "The University of Melbourne",
          },
          countryOfInstitution: {
            confidence: 0.9,
            missingOrAmbiguous: false,
            normalizedValue: "Australia",
            originalValue: "Australia",
          },
        },
        academicPerformance: {
          gradeAverageOrWam: {
            confidence: 0.9,
            missingOrAmbiguous: false,
            normalizedValue: "78.6",
            originalValue: "WAM 78.6",
          },
        },
        studyDetails: {
          completionStatus: {
            confidence: 0.9,
            missingOrAmbiguous: false,
            normalizedValue: "completed",
            originalValue: "completed",
          },
          highestEducationLevel: {
            confidence: 0.9,
            missingOrAmbiguous: false,
            normalizedValue: "bachelor",
            originalValue: "Bachelor of IT",
          },
        },
      },
      {
        completed: true,
        minWam: 65,
        qualificationLevelRequirement: "Bachelor degree",
      },
    );

    const checks = result.requirementsChecked as Array<{ id: string }>;
    const ids = checks.map((check) => check.id);

    expect(ids).toEqual([
      "deterministic-completion",
      "deterministic-qualification-level",
      "deterministic-wam-gpa-threshold",
      "deterministic-english-proficiency",
    ]);
    expect(ids.every((id) => id.startsWith("deterministic-"))).toBe(true);
    expect(result.outcome).toBe("eligible");
  });
});
