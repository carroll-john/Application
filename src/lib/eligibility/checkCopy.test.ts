import { describe, expect, it } from "vitest";
import {
  buildRecommendedNextStep,
  checkCopyByReasonCode,
  missingInformationCopyByReasonCode,
  requirementCheckDisplayCopy,
} from "./checkCopy";
import { ALL_REQUIREMENT_REASON_CODES } from "./types";

describe("checkCopyByReasonCode", () => {
  it("has non-empty applicant copy for every reason code, with and without details", () => {
    for (const code of ALL_REQUIREMENT_REASON_CODES) {
      expect(checkCopyByReasonCode[code](undefined).trim().length, code).toBeGreaterThan(0);
      expect(
        checkCopyByReasonCode[code]({
          metric: "gpa",
          observed: "5.25/7",
          required: "4/7",
        }).trim().length,
        code,
      ).toBeGreaterThan(0);
    }
  });

  it("interpolates observed/required values into threshold copy", () => {
    expect(
      checkCopyByReasonCode.GPA_MET({ metric: "gpa", observed: "5.25/7", required: "4/7" }),
    ).toBe("Your GPA of 5.25/7 meets the minimum of 4/7.");
    expect(
      checkCopyByReasonCode.WAM_BELOW({ metric: "wam", observed: "61.0", required: "65" }),
    ).toBe("Your WAM of 61.0 is below the minimum of 65.");
  });
});

describe("requirementCheckDisplayCopy", () => {
  it("uses reason-code copy when present and explanation as fallback", () => {
    expect(
      requirementCheckDisplayCopy({
        explanation: "LLM-ish free text",
        id: "gpa",
        reasonCode: "GPA_MET",
        details: { observed: "5.25/7", required: "4/7" },
        requirement: "GPA",
        status: "pass",
      }),
    ).toBe("Your GPA of 5.25/7 meets the minimum of 4/7.");

    expect(
      requirementCheckDisplayCopy({
        explanation: "Legacy service explanation",
        id: "legacy",
        requirement: "Legacy",
        status: "pass",
      }),
    ).toBe("Legacy service explanation");
  });
});

describe("buildRecommendedNextStep", () => {
  it("mentions only what is actually unresolved", () => {
    const step = buildRecommendedNextStep({
      outcome: "insufficient_data",
      unknownTranscriptReasonCodes: ["ACADEMIC_EVIDENCE_MISSING"],
      pendingEvidence: [
        {
          evidenceSource: "cv",
          kind: "work_experience",
          requirementId: "work",
        },
      ],
    });

    expect(step).toContain("WAM or GPA");
    expect(step).toContain("CV");
    expect(step).not.toContain("English");
  });

  it("returns a settled sentence when nothing is pending", () => {
    const step = buildRecommendedNextStep({ outcome: "eligible" });
    expect(step).toContain("No further transcript evidence is needed");
  });

  it("leads with the admissions framing for an ineligible outcome", () => {
    const step = buildRecommendedNextStep({ outcome: "ineligible" });
    expect(step).toContain("Admissions makes the final decision");
  });
});

describe("missingInformationCopyByReasonCode", () => {
  it("covers every transcript-unknown reason code that can produce a bullet", () => {
    for (const code of [
      "QUALIFICATION_COMPLETION_UNKNOWN",
      "QUALIFICATION_LEVEL_UNKNOWN",
      "ACADEMIC_EVIDENCE_MISSING",
      "FIELD_PROGRAM_MISSING",
      "GROUP_UNCONFIRMED",
      "SERVICE_UNAVAILABLE",
    ] as const) {
      expect(missingInformationCopyByReasonCode[code]?.(undefined)?.trim().length).toBeGreaterThan(
        0,
      );
    }
  });
});
