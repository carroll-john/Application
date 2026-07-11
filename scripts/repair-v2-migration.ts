#!/usr/bin/env tsx
/** Restores flat v1 requirements from git HEAD for courses whose v2 migration lost data. */

import { execSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { convertFlatToV2 } from "./courseRequirementsParser/v2MigrationMap.js";
import type { RequirementInstance } from "../src/lib/eligibility/requirements.js";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = resolve(__filename, "../..");
const GENERATED_PATH = resolve(repoRoot, "src/lib/courseCatalog/requirements.generated.json");

const REPAIR_CODES = [
  "monash-online-monash-university-master-of-human-resource-management",
  "master-of-business-management-with-discipline-studies-in-project-management",
  "master-of-business-marketing",
] as const;

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
  const gitJson = execSync("git show HEAD:src/lib/courseCatalog/requirements.generated.json", {
    cwd: repoRoot,
    encoding: "utf8",
  });
  const gitGenerated = JSON.parse(gitJson) as { courses: Record<string, unknown[]> };
  const current = JSON.parse(await readFile(GENERATED_PATH, "utf8")) as {
    courses: Record<string, unknown>;
  };

  for (const courseCode of REPAIR_CODES) {
    const flatRaw = gitGenerated.courses[courseCode];
    if (!Array.isArray(flatRaw)) {
      throw new Error(`No flat requirements in git for ${courseCode}`);
    }
    const flat = normalizeFlat(flatRaw);
    const converted = convertFlatToV2(courseCode, flat);
    if (!converted) {
      throw new Error(`convertFlatToV2 returned null for ${courseCode}`);
    }
    current.courses[courseCode] = converted;
    console.log(`Repaired ${courseCode} → ${converted.pathways.length} pathways`);
  }

  await writeFile(GENERATED_PATH, `${JSON.stringify(current, null, 2)}\n`, "utf8");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
