#!/usr/bin/env tsx
/**
 * Migrates flat v1 course requirements in requirements.generated.json to v2 pathway IR
 * for multi-pathway courses using the hand-curated v2MigrationMap.
 *
 *   tsx scripts/migrate-generated-requirements-v2.ts
 */

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { wrapFlatRequirementsAsV2, consolidateCourseRequirementsV2 } from "../src/lib/eligibility/courseRequirementsV2.js";
import type { RequirementInstance } from "../src/lib/eligibility/requirements.js";
import { convertFlatToV2 } from "./courseRequirementsParser/v2MigrationMap.js";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = resolve(__filename, "../..");
const GENERATED_PATH = resolve(repoRoot, "src/lib/courseCatalog/requirements.generated.json");

function normalizeFlat(raw: unknown[]): RequirementInstance[] {
  return raw.map((entry) => {
    const requirement = { ...(entry as Record<string, unknown>) };
    if (requirement.alternativeGroupId === null) {
      delete requirement.alternativeGroupId;
    }
    if (requirement.pathwayBundleId === null) {
      delete requirement.pathwayBundleId;
    }
    const params = requirement.params;
    if (params && typeof params === "object") {
      const paramsRecord = { ...(params as Record<string, unknown>) };
      for (const key of Object.keys(paramsRecord)) {
        if (paramsRecord[key] === null) {
          delete paramsRecord[key];
        }
      }
      requirement.params = paramsRecord;
    }
    return requirement as RequirementInstance;
  });
}

async function main() {
  const generated = JSON.parse(await readFile(GENERATED_PATH, "utf8")) as {
    version: number;
    generatedAt: string | null;
    model: string | null;
    courses: Record<string, unknown>;
  };

  let migratedCount = 0;

  for (const [courseCode, rawEntry] of Object.entries(generated.courses)) {
    if (!Array.isArray(rawEntry)) {
      continue;
    }
    if (rawEntry.length === 0) {
      continue;
    }

    const flat = normalizeFlat(rawEntry);
    const converted = convertFlatToV2(courseCode, flat);
    if (converted) {
      generated.courses[courseCode] = consolidateCourseRequirementsV2(converted);
      migratedCount += 1;
      continue;
    }

    generated.courses[courseCode] = consolidateCourseRequirementsV2(wrapFlatRequirementsAsV2(flat));
    migratedCount += 1;
  }

  generated.version = 2;
  generated.generatedAt = new Date().toISOString();

  await writeFile(GENERATED_PATH, `${JSON.stringify(generated, null, 2)}\n`, "utf8");
  console.log(`Migrated ${migratedCount} courses to v2 IR in ${GENERATED_PATH}`);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
