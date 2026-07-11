#!/usr/bin/env tsx
/**
 * Builds golden course-requirements fixtures from the committed generated catalog.
 * Run after updating requirements.generated.json or v2MigrationMap.ts.
 *
 *   tsx scripts/build-course-requirements-golden.ts
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { wrapFlatRequirementsAsV2 } from "../src/lib/eligibility/courseRequirementsV2.js";
import type { RequirementInstance } from "../src/lib/eligibility/requirements.js";
import { GOLDEN_COURSE_CODES } from "../src/lib/eligibility/courseRequirementsGolden.js";
import { convertFlatToV2 } from "./courseRequirementsParser/v2MigrationMap.js";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = resolve(__filename, "../..");
const RAW_CATALOG_PATH = resolve(repoRoot, "src/data/courses.raw.json");
const GENERATED_PATH = resolve(repoRoot, "src/lib/courseCatalog/requirements.generated.json");
const FIXTURE_ROOT = resolve(repoRoot, "tests/fixtures/course-requirements");

interface RawCourseEntry {
  course_name: string;
  provider_name: string;
  entry_requirements?: string | null;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildCourseCode(course: RawCourseEntry, baseCodeCounts: Record<string, number>): string {
  if (
    /southern cross university/i.test(course.provider_name) &&
    /master of business administration/i.test(course.course_name) &&
    /online/i.test(course.course_name)
  ) {
    return "mba-online";
  }
  const baseCode = slugify(course.course_name);
  if ((baseCodeCounts[baseCode] ?? 0) === 1) {
    return baseCode;
  }
  return `${slugify(course.provider_name)}-${baseCode}`;
}

function hashText(text: string): string {
  return createHash("sha256").update(text.trim()).digest("hex").slice(0, 16);
}

function normalizeFlat(raw: unknown[]): RequirementInstance[] {
  return raw.map((entry) => {
    const requirement = { ...(entry as Record<string, unknown>) };
    if (requirement.alternativeGroupId === null) {
      delete requirement.alternativeGroupId;
    }
    if (requirement.pathwayBundleId === null) {
      delete requirement.pathwayBundleId;
    }
    return requirement as RequirementInstance;
  });
}

function resolveExpectedEntry(
  courseCode: string,
  rawEntry: unknown,
): unknown {
  if (Array.isArray(rawEntry) && rawEntry.length > 0) {
    const flat = normalizeFlat(rawEntry);
    const converted = convertFlatToV2(courseCode, flat);
    if (converted) {
      return converted;
    }
    return wrapFlatRequirementsAsV2(flat);
  }
  if (Array.isArray(rawEntry)) {
    return { version: 2, global: [], pathways: [] };
  }
  return rawEntry;
}

async function main() {
  const rawData = JSON.parse(await readFile(RAW_CATALOG_PATH, "utf8")) as {
    courses: RawCourseEntry[];
  };
  const generated = JSON.parse(await readFile(GENERATED_PATH, "utf8")) as {
    courses: Record<string, unknown>;
  };

  const baseCodeCounts: Record<string, number> = {};
  for (const course of rawData.courses) {
    const baseCode = slugify(course.course_name);
    baseCodeCounts[baseCode] = (baseCodeCounts[baseCode] ?? 0) + 1;
  }

  const codeToEntry = new Map<string, RawCourseEntry>();
  for (const course of rawData.courses) {
    codeToEntry.set(buildCourseCode(course, baseCodeCounts), course);
  }

  await mkdir(FIXTURE_ROOT, { recursive: true });

  const manifestEntries = [];

  for (const courseCode of GOLDEN_COURSE_CODES) {
    const course = codeToEntry.get(courseCode);
    const entryText = (course?.entry_requirements ?? "").trim();
    const expected = resolveExpectedEntry(courseCode, generated.courses[courseCode]);
    const expectedPath = `${courseCode}.expected.json`;

    await writeFile(
      resolve(FIXTURE_ROOT, expectedPath),
      `${JSON.stringify(expected, null, 2)}\n`,
      "utf8",
    );

    manifestEntries.push({
      courseCode,
      entryRequirementsHash: hashText(entryText),
      expectedFile: expectedPath,
      hasEntryText: Boolean(entryText),
    });
  }

  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    courses: manifestEntries,
  };

  await writeFile(
    resolve(FIXTURE_ROOT, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  console.log(`Wrote ${manifestEntries.length} golden fixtures to ${FIXTURE_ROOT}`);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
