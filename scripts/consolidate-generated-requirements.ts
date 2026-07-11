#!/usr/bin/env tsx
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  consolidateCourseRequirementsV2,
  isCourseRequirementsV2,
} from "../src/lib/eligibility/courseRequirementsV2.js";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = resolve(__filename, "../..");
const GENERATED_PATH = resolve(repoRoot, "src/lib/courseCatalog/requirements.generated.json");

async function main() {
  const generated = JSON.parse(await readFile(GENERATED_PATH, "utf8")) as {
    courses: Record<string, unknown>;
  };

  let count = 0;
  for (const [courseCode, entry] of Object.entries(generated.courses)) {
    if (!isCourseRequirementsV2(entry)) {
      continue;
    }
    generated.courses[courseCode] = consolidateCourseRequirementsV2(entry);
    count += 1;
  }

  await writeFile(GENERATED_PATH, `${JSON.stringify(generated, null, 2)}\n`, "utf8");
  console.log(`Consolidated paired qualification requirements in ${count} courses`);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
