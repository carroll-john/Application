import { describe, expect, it } from "vitest";
import { runSchemaCompatibilityFixtures } from "./schemaCompatibility.fixtures";

describe("schema compatibility validator", () => {
  it("matches the expected outcome for all frozen and negative fixtures", () => {
    const results = runSchemaCompatibilityFixtures();
    const failures = results.filter((result) => !result.matchedExpectation);

    expect(
      failures.map((failure) => ({
        fixture: failure.fixture.name,
        compatible: failure.result.compatible,
        issues: failure.result.issues.map((issue) => issue.message),
        missingExpectedMessages: failure.missingExpectedMessages,
      })),
    ).toEqual([]);
  });
});
