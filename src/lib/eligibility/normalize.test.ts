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

  it("reads nested extractedData payloads", () => {
    const normalized = normalizeTranscriptEligibilityAssessment({
      confidence: 0.9,
      outcome: "eligible",
      extractedData: {
        studyDetails: {
          programName: {
            confidence: 0.9,
            normalizedValue: "Bachelor of Science",
          },
        },
      },
    });

    expect(normalized.extractedData.studyDetails?.programName).toMatchObject({
      normalizedValue: "Bachelor of Science",
    });
  });

  it("preserves academic unit result rows", () => {
    const normalized = normalizeTranscriptEligibilityAssessment({
      confidence: 0.9,
      outcome: "eligible",
      academicPerformance: {
        gradeAverageOrWam: null,
        unitResults: [
          {
            counted: true,
            creditPoints: "10",
            grade: "F",
            mark: "41",
            notes: "Masters only",
            title: "International Trade and Finance",
            unitCode: "IBUS8020",
          },
        ],
      },
    });

    expect(normalized.extractedData.academicPerformance?.unitResults).toEqual([
      {
        counted: true,
        creditPoints: 10,
        grade: "F",
        mark: 41,
        notes: "Masters only",
        title: "International Trade and Finance",
        unitCode: "IBUS8020",
      },
    ]);
  });

  it("preserves reasonCode, details, pendingEvidence, notes, and version stamps", () => {
    const normalized = normalizeTranscriptEligibilityAssessment({
      confidence: 0.85,
      outcome: "eligible",
      extractionNotes: ["Grading key partially unreadable."],
      modelId: "gpt-4.1-mini",
      pendingEvidence: [
        {
          evidenceSource: "cv",
          kind: "work_experience",
          reasonCode: "WORK_EXPERIENCE_UNVERIFIED",
          requirementId: "work",
        },
        { evidenceSource: "not-a-source", kind: "x", requirementId: "bad" },
      ],
      promptVersion: "transcript-eligibility@v2",
      requirementsChecked: [
        {
          details: { metric: "gpa", observed: "5.25/7", required: "4/7" },
          explanation: "GPA 5.25/7 meets minimum GPA 4/7.",
          id: "gpa",
          reasonCode: "GPA_MET",
          requirement: "Minimum GPA 4/7",
          status: "pass",
        },
        {
          explanation: "Something",
          id: "other",
          reasonCode: "NOT_A_REAL_CODE",
          requirement: "Other",
          status: "pass",
        },
      ],
      schemaVersion: "transcript_eligibility_extraction@v2",
    });

    expect(normalized.requirementsChecked[0]).toMatchObject({
      details: { metric: "gpa", observed: "5.25/7", required: "4/7" },
      reasonCode: "GPA_MET",
    });
    // Unknown reason codes are dropped rather than passed through unvalidated.
    expect(normalized.requirementsChecked[1].reasonCode).toBeUndefined();
    expect(normalized.pendingEvidence).toEqual([
      {
        evidenceSource: "cv",
        kind: "work_experience",
        reasonCode: "WORK_EXPERIENCE_UNVERIFIED",
        requirementId: "work",
      },
    ]);
    expect(normalized.extractionNotes).toEqual(["Grading key partially unreadable."]);
    expect(normalized.modelId).toBe("gpt-4.1-mini");
    expect(normalized.promptVersion).toBe("transcript-eligibility@v2");
    expect(normalized.schemaVersion).toBe("transcript_eligibility_extraction@v2");
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
