import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { runSchemaCompatibilityFixtures } from "../src/integrationPlatform/schemaCompatibility.fixtures.ts";

function parseArguments(argv: string[]): { reportPath?: string } {
  const args = [...argv];
  let reportPath: string | undefined;

  while (args.length > 0) {
    const token = args.shift();

    if (token === "--report") {
      reportPath = args.shift();
    }
  }

  return {
    reportPath,
  };
}

function buildReportLines(): { failed: boolean; lines: string[] } {
  const results = runSchemaCompatibilityFixtures();
  const lines: string[] = [
    "Schema compatibility report",
    "===========================",
    "",
  ];

  let failed = false;

  results.forEach((entry) => {
    const status = entry.matchedExpectation ? "PASS" : "FAIL";
    lines.push(`${status} ${entry.fixture.name}`);
    lines.push(`  Description: ${entry.fixture.description}`);
    lines.push(`  Expected compatible: ${entry.fixture.expectedCompatible ? "yes" : "no"}`);
    lines.push(`  Actual compatible: ${entry.result.compatible ? "yes" : "no"}`);

    if (entry.result.issues.length === 0) {
      lines.push("  Issues: none");
    } else {
      lines.push("  Issues:");
      entry.result.issues.forEach((issue) => {
        lines.push(`    - [${issue.path}] ${issue.message}`);
      });
    }

    if (entry.missingExpectedMessages.length > 0) {
      lines.push("  Missing expected issue messages:");
      entry.missingExpectedMessages.forEach((message) => {
        lines.push(`    - ${message}`);
      });
    }

    lines.push("");

    if (!entry.matchedExpectation) {
      failed = true;
    }
  });

  return { failed, lines };
}

const { reportPath } = parseArguments(process.argv.slice(2));
const { failed, lines } = buildReportLines();
const report = `${lines.join("\n")}\n`;

process.stdout.write(report);

if (reportPath) {
  const resolvedReportPath = resolve(reportPath);
  mkdirSync(dirname(resolvedReportPath), { recursive: true });
  writeFileSync(resolvedReportPath, report, "utf8");
}

if (failed) {
  process.exitCode = 1;
}
