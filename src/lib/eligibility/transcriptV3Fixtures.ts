import manifest from "../../../tests/fixtures/transcript-v3/manifest.json";
import type { EligibilityOutcome } from "./types";

export interface TranscriptV3ManifestFixture {
  fixture_id: string;
  file: string;
  university: string;
  document_title: string;
  student_name: string;
  qualification_achieved: boolean;
  qualification_achieved_detail: string;
  page_count: number;
}

export interface TranscriptV3FixtureExpectation {
  fixtureId: string;
  pdfFileName: string;
  university: string;
  qualificationAchieved: boolean;
  scenario: string;
  /**
   * Soft outcome bucket used by the live PDF regression harness. Conferred/completed
   * transcripts should not land in `ineligible`; incomplete/discontinued should not
   * land in `eligible` when `--strict` is enabled.
   */
  expectedOutcomeBucket: "eligible_or_review" | "not_eligible";
}

const FIXTURE_ROOT = "tests/fixtures/transcript-v3";

function toExpectation(fixture: TranscriptV3ManifestFixture): TranscriptV3FixtureExpectation {
  const detail = fixture.qualification_achieved_detail.toLowerCase();
  const pendingOrIncomplete =
    !fixture.qualification_achieved &&
    (detail.includes("pending") ||
      detail.includes("current enrolment") ||
      detail.includes("not completed") ||
      detail.includes("requirements completed"));

  return {
    fixtureId: fixture.fixture_id,
    pdfFileName: fixture.file.replace(/^pdfs\//, ""),
    university: fixture.university,
    qualificationAchieved: fixture.qualification_achieved,
    scenario: fixture.qualification_achieved_detail,
    expectedOutcomeBucket:
      fixture.qualification_achieved || pendingOrIncomplete
        ? "eligible_or_review"
        : "not_eligible",
  };
}

export const transcriptV3ManifestFixtures = (
  manifest as { fixtures: TranscriptV3ManifestFixture[] }
).fixtures;

export const transcriptV3FixtureExpectations: TranscriptV3FixtureExpectation[] =
  transcriptV3ManifestFixtures.map(toExpectation);

export function resolveTranscriptV3PdfPath(pdfFileName: string) {
  return `${FIXTURE_ROOT}/pdfs/${pdfFileName}`;
}

export function isOutcomeCompatibleWithBucket(
  outcome: EligibilityOutcome,
  bucket: TranscriptV3FixtureExpectation["expectedOutcomeBucket"],
) {
  if (bucket === "eligible_or_review") {
    return outcome !== "ineligible";
  }

  return outcome === "ineligible" || outcome === "insufficient_data";
}
