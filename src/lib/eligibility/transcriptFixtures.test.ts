import { describe, expect, it } from "vitest";
import { normalizeTranscriptEligibilityAssessment } from "./normalize";
import {
  buildFixtureServicePayload,
  transcriptFixtureExpectations,
} from "./transcriptFixtures";

describe("transcript fixture contract matrix", () => {
  it("covers all synthetic transcript fixture ids", () => {
    expect(transcriptFixtureExpectations).toHaveLength(12);
    expect(transcriptFixtureExpectations.map((fixture) => fixture.id)).toEqual([
      "AU-TX-001",
      "AU-TX-002",
      "AU-TX-003",
      "AU-TX-004",
      "AU-TX-005",
      "AU-TX-006",
      "AU-TX-007",
      "AU-TX-008",
      "AU-TX-009",
      "AU-TX-010",
      "AU-TX-011",
      "AU-TX-012",
    ]);
  });

  it.each(transcriptFixtureExpectations)(
    "normalizes expected status for $id ($institution)",
    (fixture) => {
      const normalized = normalizeTranscriptEligibilityAssessment(
        buildFixtureServicePayload(fixture),
      );

      expect(normalized.outcome).toBe(fixture.expectedOutcome);
      expect(normalized.manualReviewRequired).toBe(fixture.expectsManualReview);
      expect(normalized.requirementsChecked[0]).toMatchObject({
        id: "primary-requirement",
        status: fixture.expectedPrimaryRequirementStatus,
      });
    },
  );
});

