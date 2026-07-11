#!/usr/bin/env tsx
/**
 * Parser eval harness — scores committed requirements.generated.json against golden fixtures.
 *
 *   npm run eligibility:parse-eval
 *   npm run eligibility:parse-eval -- --verbose
 *   npm run eligibility:parse-eval -- --code=master-of-health-management
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluateCourseRequirements,
  isEvalPassing,
} from "../src/lib/eligibility/courseRequirementsEval.js";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = resolve(__filename, "../..");
const FIXTURE_ROOT = resolve(repoRoot, "tests/fixtures/course-requirements");
const GENERATED_PATH = resolve(repoRoot, "src/lib/courseCatalog/requirements.generated.json");

interface Manifest {
  courses: Array<{ courseCode: string; expectedFile: string }>;
}

interface Flags {
  code?: string;
  verbose: boolean;
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { verbose: false };
  for (const arg of argv.slice(2)) {
    if (arg === "--verbose") flags.verbose = true;
    else if (arg.startsWith("--code=")) flags.code = arg.slice("--code=".length);
  }
  return flags;
}

async function main() {
  const flags = parseFlags(process.argv);
  const manifest = JSON.parse(
    await readFile(resolve(FIXTURE_ROOT, "manifest.json"), "utf8"),
  ) as Manifest;
  const generated = JSON.parse(await readFile(GENERATED_PATH, "utf8")) as {
    courses: Record<string, unknown>;
  };

  const targets = manifest.courses.filter((entry) =>
    flags.code ? entry.courseCode === flags.code : true,
  );

  if (targets.length === 0) {
    throw new Error(flags.code ? `No golden fixture for ${flags.code}` : "No fixtures in manifest.");
  }

  console.log(`Course requirements parser eval — ${targets.length} course(s)\n`);

  let failures = 0;

  for (const target of targets) {
    const expected = JSON.parse(
      await readFile(resolve(FIXTURE_ROOT, target.expectedFile), "utf8"),
    );
    const actual = generated.courses[target.courseCode];
    const result = evaluateCourseRequirements(target.courseCode, expected, actual);
    const passed = isEvalPassing(result);
    const status = passed ? "OK  " : "FAIL";

    console.log(`  [${status}] ${target.courseCode}`);
    console.log(
      `       leafRecall=${result.scores.leafRecall.toFixed(2)} paramAccuracy=${result.scores.paramAccuracy.toFixed(2)} structure=${result.scores.structureAccuracy.toFixed(2)} sourceText=${result.scores.sourceTextFidelity.toFixed(2)} safe=${result.scores.safetyPass}`,
    );

    if (!passed || flags.verbose) {
      if (result.missingLeafIds.length > 0) {
        console.log(`       missing leaves: ${result.missingLeafIds.join(", ")}`);
      }
      if (result.structureMismatches.length > 0) {
        console.log(`       structure: ${result.structureMismatches.join("; ")}`);
      }
      if (result.paramMismatches.length > 0) {
        console.log(`       params: ${result.paramMismatches.slice(0, 5).join(", ")}`);
      }
      if (!result.scores.safetyPass) {
        console.log("       safety: matcher-unsafe output");
      }
    }

    if (!passed) failures += 1;
  }

  if (failures > 0) {
    console.error(`\n${failures} of ${targets.length} courses FAILED.`);
    process.exit(1);
  }

  console.log(`\nAll ${targets.length} courses passed.`);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
