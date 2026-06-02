import { describe, expect, it } from "vitest";

import { evaluateRequirements } from "./matcher";
import type { RequirementInstance } from "./requirements";
import type {
  RequirementReasonCode,
  TranscriptEligibilityRequestContext,
  TranscriptExtractedData,
} from "./types";

/**
 * Asserts the stable machine-readable reason code attached to each requirement check.
 * Reason codes are additive metadata alongside the free-text explanation.
 */

function ctx(): TranscriptEligibilityRequestContext {
  return {};
}

function only(
  instance: RequirementInstance,
  evidence: TranscriptExtractedData,
): RequirementReasonCode | undefined {
  const [check] = evaluateRequirements([instance], evidence, ctx());
  return check.reasonCode;
}

const QUAL_COMPLETED: RequirementInstance = {
  id: "c",
  kind: "qualification_completed",
  params: {},
  sourceText: "Completed bachelor degree.",
  weight: "mandatory",
};

describe("requirement reason codes", () => {
  it("qualification_completed", () => {
    expect(
      only(QUAL_COMPLETED, {
        studyDetails: { completionStatus: { confidence: 1, normalizedValue: "completed" } },
      }),
    ).toBe("QUALIFICATION_COMPLETE");
    expect(
      only(QUAL_COMPLETED, {
        studyDetails: { completionStatus: { confidence: 1, normalizedValue: "in progress" } },
      }),
    ).toBe("QUALIFICATION_INCOMPLETE");
    expect(only(QUAL_COMPLETED, {})).toBe("QUALIFICATION_COMPLETION_UNKNOWN");
  });

  it("qualification_level", () => {
    const instance: RequirementInstance = {
      id: "l",
      kind: "qualification_level",
      params: { level: "bachelor" },
      sourceText: "Bachelor degree.",
      weight: "mandatory",
    };
    expect(
      only(instance, {
        studyDetails: { highestEducationLevel: { confidence: 1, normalizedValue: "Master of X" } },
      }),
    ).toBe("QUALIFICATION_LEVEL_MET");
    expect(
      only(instance, {
        studyDetails: { highestEducationLevel: { confidence: 1, normalizedValue: "Diploma" } },
      }),
    ).toBe("QUALIFICATION_LEVEL_BELOW");
    expect(only(instance, {})).toBe("QUALIFICATION_LEVEL_UNKNOWN");
  });

  it("academic_threshold (wam + gpa + missing)", () => {
    const wam: RequirementInstance = {
      id: "w",
      kind: "academic_threshold",
      params: { metric: "wam", min: 65 },
      sourceText: "WAM 65.",
      weight: "mandatory",
    };
    expect(
      only(wam, { academicPerformance: { gradeAverageOrWam: { confidence: 1, normalizedValue: "70" } } }),
    ).toBe("WAM_MET");
    expect(
      only(wam, { academicPerformance: { gradeAverageOrWam: { confidence: 1, normalizedValue: "50" } } }),
    ).toBe("WAM_BELOW");
    expect(only(wam, {})).toBe("ACADEMIC_EVIDENCE_MISSING");

    const gpa: RequirementInstance = {
      id: "g",
      kind: "academic_threshold",
      params: { metric: "gpa", min: 5, scale: 7 },
      sourceText: "GPA 5/7.",
      weight: "mandatory",
    };
    expect(
      only(gpa, {
        academicPerformance: {
          gpa: { confidence: 1, normalizedValue: "6" },
          gpaScale: { confidence: 1, normalizedValue: "7" },
        },
      }),
    ).toBe("GPA_MET");
    expect(
      only(gpa, {
        academicPerformance: {
          gpa: { confidence: 1, normalizedValue: "3" },
          gpaScale: { confidence: 1, normalizedValue: "7" },
        },
      }),
    ).toBe("GPA_BELOW");
  });

  it("english_proficiency", () => {
    const instance: RequirementInstance = {
      id: "e",
      kind: "english_proficiency",
      params: { acceptedPathways: [{ type: "completion_in_country", countries: ["AU"] }] },
      sourceText: "English proficiency.",
      weight: "mandatory",
    };
    expect(
      only(instance, {
        applicantDetails: { countryOfInstitution: { confidence: 1, normalizedValue: "Australia" } },
      }),
    ).toBe("ENGLISH_OK_COUNTRY");
    expect(only(instance, {})).toBe("ENGLISH_UNVERIFIED");
    expect(
      evaluateRequirements([instance], {}, { languageTestsCount: 1 })[0].reasonCode,
    ).toBe("ENGLISH_TEST_UNVERIFIED");
  });

  it("work_experience and field_of_study", () => {
    expect(
      only(
        {
          id: "we",
          kind: "work_experience",
          params: { minYears: 3 },
          sourceText: "3 years experience.",
          weight: "mandatory",
        },
        {},
      ),
    ).toBe("WORK_EXPERIENCE_UNVERIFIED");

    const field: RequirementInstance = {
      id: "f",
      kind: "field_of_study",
      params: { acceptedAreas: ["business"] },
      sourceText: "Business field.",
      weight: "mandatory",
    };
    expect(
      only(field, { studyDetails: { programName: { confidence: 1, normalizedValue: "Bachelor of Business" } } }),
    ).toBe("FIELD_MATCH");
    expect(
      only(field, { studyDetails: { programName: { confidence: 1, normalizedValue: "Bachelor of Arts" } } }),
    ).toBe("FIELD_MISMATCH");
    expect(only(field, {})).toBe("FIELD_PROGRAM_MISSING");
  });

  it("alternative-group fold codes", () => {
    const mk = (id: string, country: string): RequirementInstance => ({
      id,
      kind: "english_proficiency",
      params: { acceptedPathways: [{ type: "completion_in_country", countries: [country] }] },
      sourceText: `Completed in ${country}.`,
      weight: "alternative",
      alternativeGroupId: "grp",
    });
    const evidenceAU: TranscriptExtractedData = {
      applicantDetails: { countryOfInstitution: { confidence: 1, normalizedValue: "Australia" } },
    };

    const passed = evaluateRequirements([mk("a", "AU"), mk("b", "NZ")], evidenceAU, ctx());
    expect(passed[0].reasonCode).toBe("GROUP_SATISFIED");

    const unconfirmed = evaluateRequirements([mk("a", "NZ"), mk("b", "UK")], evidenceAU, ctx());
    expect(unconfirmed[0].reasonCode).toBe("GROUP_UNCONFIRMED");
  });
});
