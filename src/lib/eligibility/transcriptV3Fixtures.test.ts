import { describe, expect, it } from "vitest";
import {
  isOutcomeCompatibleWithBucket,
  resolveTranscriptV3PdfPath,
  transcriptV3FixtureExpectations,
  transcriptV3ManifestFixtures,
} from "./transcriptV3Fixtures";

describe("transcript v3 fixture pack", () => {
  it("loads all 14 document-like AU transcript fixtures", () => {
    expect(transcriptV3ManifestFixtures).toHaveLength(14);
    expect(transcriptV3FixtureExpectations.map((fixture) => fixture.fixtureId)).toEqual([
      "AU-TX-V3-001",
      "AU-TX-V3-002",
      "AU-TX-V3-003",
      "AU-TX-V3-004",
      "AU-TX-V3-005",
      "AU-TX-V3-006",
      "AU-TX-V3-007",
      "AU-TX-V3-008",
      "AU-TX-V3-009",
      "AU-TX-V3-010",
      "AU-TX-V3-011",
      "AU-TX-V3-012",
      "AU-TX-V3-013",
      "AU-TX-V3-014",
    ]);
  });

  it("maps pdf paths under tests/fixtures/transcript-v3/pdfs", () => {
    for (const fixture of transcriptV3FixtureExpectations) {
      expect(resolveTranscriptV3PdfPath(fixture.pdfFileName)).toBe(
        `tests/fixtures/transcript-v3/pdfs/${fixture.pdfFileName}`,
      );
    }
  });

  it("classifies outcome buckets consistently", () => {
    expect(
      isOutcomeCompatibleWithBucket("eligible", "eligible_or_review"),
    ).toBe(true);
    expect(
      isOutcomeCompatibleWithBucket("conditionally_eligible", "eligible_or_review"),
    ).toBe(true);
    expect(isOutcomeCompatibleWithBucket("ineligible", "not_eligible")).toBe(true);
    expect(isOutcomeCompatibleWithBucket("eligible", "not_eligible")).toBe(false);
  });
});
