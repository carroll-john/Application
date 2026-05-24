#!/usr/bin/env tsx
/**
 * Offline eligibility eval harness.
 *
 * Runs the pure `evaluateRequirements` matcher across the matcher fixtures in
 * `src/lib/eligibility/matcherFixtures.ts` and reports:
 *   - Per-fixture pass/fail summary
 *   - Per-requirement precision/recall (predicted vs expected status, by status)
 *   - Aggregate outcome accuracy
 *
 * Exits with code 1 if any fixture fails its expectations — wire this into CI to gate merges on
 * eligibility-decision regressions.
 *
 * Usage:
 *   npm run eligibility:eval
 *   npm run eligibility:eval -- --verbose
 */

import { aggregateOutcome, evaluateRequirements } from "../src/lib/eligibility/matcher.js";
import { matcherFixtures, type MatcherFixture } from "../src/lib/eligibility/matcherFixtures.js";
import type { EligibilityRequirementStatus } from "../src/lib/eligibility/types.js";

const ALL_STATUSES: EligibilityRequirementStatus[] = ["pass", "fail", "unknown"];

interface FixtureResult {
  fixture: MatcherFixture;
  perRequirement: Array<{
    id: string;
    expected: EligibilityRequirementStatus;
    actual: EligibilityRequirementStatus;
    correct: boolean;
  }>;
  outcomeCorrect: boolean;
  actualOutcome: string;
}

function runFixture(fixture: MatcherFixture): FixtureResult {
  const checks = evaluateRequirements(fixture.requirements, fixture.evidence, fixture.context);
  const checkById = new Map(checks.map((check) => [check.id, check]));

  const perRequirement: FixtureResult["perRequirement"] = [];
  for (const [id, expected] of Object.entries(fixture.expectedStatusById)) {
    // Alternative-group ids in the matcher's output carry a suffix like ":satisfied" / ":failed" /
    // ":unknown". Try the bare id first; if not found, look for any check whose id starts with
    // `${id}:` so the fixture can express expectations using the alternativeGroupId directly.
    const direct = checkById.get(id);
    const prefixed = direct
      ? undefined
      : checks.find((check) => check.id.startsWith(`${id}:`));
    const actual = direct?.status ?? prefixed?.status ?? "unknown";

    perRequirement.push({
      id,
      expected,
      actual,
      correct: actual === expected,
    });
  }

  const { outcome } = aggregateOutcome(checks);

  return {
    fixture,
    perRequirement,
    outcomeCorrect: outcome === fixture.expectedOutcome,
    actualOutcome: outcome,
  };
}

function computeStatusMetrics(results: FixtureResult[]) {
  const metrics: Record<
    EligibilityRequirementStatus,
    { truePositive: number; falsePositive: number; falseNegative: number }
  > = {
    pass: { truePositive: 0, falsePositive: 0, falseNegative: 0 },
    fail: { truePositive: 0, falsePositive: 0, falseNegative: 0 },
    unknown: { truePositive: 0, falsePositive: 0, falseNegative: 0 },
  };

  for (const result of results) {
    for (const row of result.perRequirement) {
      if (row.expected === row.actual) {
        metrics[row.expected].truePositive += 1;
      } else {
        metrics[row.expected].falseNegative += 1;
        metrics[row.actual].falsePositive += 1;
      }
    }
  }

  return metrics;
}

function safeDivide(numerator: number, denominator: number) {
  return denominator === 0 ? 1 : numerator / denominator;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function main() {
  const verbose = process.argv.includes("--verbose");
  const results = matcherFixtures.map(runFixture);

  let failures = 0;

  console.log(`Eligibility matcher eval — ${results.length} fixture(s)\n`);

  for (const result of results) {
    const fixtureFailed =
      !result.outcomeCorrect || result.perRequirement.some((row) => !row.correct);

    const status = fixtureFailed ? "FAIL" : "OK  ";
    console.log(`  [${status}] ${result.fixture.id}: ${result.fixture.scenario}`);

    if (fixtureFailed || verbose) {
      if (!result.outcomeCorrect) {
        console.log(
          `       outcome: expected ${result.fixture.expectedOutcome}, actual ${result.actualOutcome}`,
        );
      }
      for (const row of result.perRequirement) {
        if (!row.correct || verbose) {
          const marker = row.correct ? "·" : "✗";
          console.log(`       ${marker} ${row.id}: expected ${row.expected}, actual ${row.actual}`);
        }
      }
    }

    if (fixtureFailed) failures += 1;
  }

  const metrics = computeStatusMetrics(results);

  console.log("\nPer-status metrics:");
  console.log("  Status   | Precision | Recall  | F1");
  console.log("  ---------|-----------|---------|--------");
  for (const status of ALL_STATUSES) {
    const m = metrics[status];
    const precision = safeDivide(m.truePositive, m.truePositive + m.falsePositive);
    const recall = safeDivide(m.truePositive, m.truePositive + m.falseNegative);
    const f1 = safeDivide(2 * precision * recall, precision + recall);
    console.log(
      `  ${status.padEnd(8)} | ${formatPercent(precision).padStart(9)} | ${formatPercent(recall).padStart(7)} | ${formatPercent(f1).padStart(6)}`,
    );
  }

  const outcomeAccuracy = results.filter((r) => r.outcomeCorrect).length / results.length;
  console.log(`\nAggregate outcome accuracy: ${formatPercent(outcomeAccuracy)}`);

  if (failures > 0) {
    console.error(`\n${failures} of ${results.length} fixtures FAILED.`);
    process.exit(1);
  }

  console.log(`\nAll ${results.length} fixtures passed.`);
}

main();
