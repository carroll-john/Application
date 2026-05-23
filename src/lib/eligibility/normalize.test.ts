import { describe, expect, it } from "vitest";
import { normalizeTranscriptEligibilityAssessment } from "./normalize";

describe("normalizeTranscriptEligibilityAssessment", () => {
  it("normalizes valid payload values", () => {
    const normalized = normalizeTranscriptEligibilityAssessment({
      confidence: 0.92,
      outcome: "conditionally_eligible",
      programCode: "MDA900",
      requirementsChecked: [
        {
          explanation: "Requirement met.",
          id: "education-level",
          requirement: "Completed bachelor degree",
          status: "pass",
        },
      ],
      studyDetails: {
        completionStatus: {
          confidence: 0.95,
          normalizedValue: "completed",
          originalValue: "Completed - award conferred",
        },
      },
    });

    expect(normalized.outcome).toBe("conditionally_eligible");
    expect(normalized.programCode).toBe("MDA900");
    expect(normalized.requirementsChecked[0]).toMatchObject({
      id: "education-level",
      status: "pass",
    });
    expect(normalized.extractedData.studyDetails?.completionStatus).toMatchObject({
      normalizedValue: "completed",
      originalValue: "Completed - award conferred",
    });
  });

  it("falls back to insufficient_data for unknown payloads", () => {
    const normalized = normalizeTranscriptEligibilityAssessment({
      confidence: 9,
      outcome: "unknown-state",
      requirementsChecked: [{ requirement: "GPA", status: "invalid" }],
    });

    expect(normalized.outcome).toBe("insufficient_data");
    expect(normalized.confidence).toBe(1);
    expect(normalized.requirementsChecked[0]).toMatchObject({
      status: "unknown",
    });
    expect(normalized.recommendedNextStep).toContain("Provide additional transcript evidence");
  });
});

