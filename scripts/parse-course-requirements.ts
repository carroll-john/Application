#!/usr/bin/env tsx
/**
 * Offline parser: turns each course's `entry_requirements` text into CourseRequirementsV2 IR
 * via a multi-stage agent pipeline (segment → classify → structure → validate → repair).
 *
 * Usage:
 *   OPENAI_API_KEY=... npm run eligibility:parse-requirements
 *   OPENAI_API_KEY=... npm run eligibility:parse-requirements -- --code=mba-online
 *   OPENAI_API_KEY=... npm run eligibility:parse-requirements -- --force
 *   npm run eligibility:parse-requirements -- --dry
 *   npm run eligibility:parse-requirements -- --stage=validate --code=master-of-health-management
 *
 * Flags:
 *   --code=<courseCode>   Parse only the named course code.
 *   --catalog=default|uc  Select the committed catalogue (default: default).
 *   --force               Re-parse courses even if they already have generated requirements.
 *   --dry                 Print planned work without API calls or writes.
 *   --model=<name>        Override OpenAI model (default: gpt-4.1-mini).
 *   --stage=validate      Score existing generated output against golden fixtures (no API).
 */

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isCourseRequirementsV2 } from "../src/lib/eligibility/courseRequirementsV2.js";
import {
  DEFAULT_PARSER_MODEL,
  runExtractionPipeline,
} from "./courseRequirementsParser/pipeline.js";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = resolve(__filename, "../..");

type CatalogId = "default" | "uc";

const CATALOG_PATHS: Record<CatalogId, { raw: string; generated: string }> = {
  default: {
    raw: resolve(repoRoot, "src/data/courses.raw.json"),
    generated: resolve(repoRoot, "src/lib/courseCatalog/requirements.generated.json"),
  },
  uc: {
    raw: resolve(repoRoot, "src/data/courses.uc.raw.json"),
    generated: resolve(repoRoot, "src/lib/courseCatalog/requirements.uc.generated.json"),
  },
};

interface RawCourseEntry {
  course_name: string;
  provider_name: string;
  entry_requirements?: string | null;
}

interface RawCatalog {
  courses: RawCourseEntry[];
}

interface GeneratedFile {
  version: number;
  generatedAt: string | null;
  model: string | null;
  courses: Record<string, unknown>;
}

interface ParseFlags {
  catalog: CatalogId;
  code?: string;
  force: boolean;
  dry: boolean;
  model: string;
  stage?: string;
}

function parseFlags(argv: string[]): ParseFlags {
  const flags: ParseFlags = {
    catalog: "default",
    force: false,
    dry: false,
    model: DEFAULT_PARSER_MODEL,
  };
  for (const arg of argv.slice(2)) {
    if (arg === "--force") flags.force = true;
    else if (arg === "--dry") flags.dry = true;
    else if (arg.startsWith("--code=")) flags.code = arg.slice("--code=".length);
    else if (arg.startsWith("--model=")) flags.model = arg.slice("--model=".length);
    else if (arg.startsWith("--stage=")) flags.stage = arg.slice("--stage=".length);
    else if (arg.startsWith("--catalog=")) {
      const catalog = arg.slice("--catalog=".length);
      if (catalog !== "default" && catalog !== "uc") {
        throw new Error(`Unknown catalogue: ${catalog}`);
      }
      flags.catalog = catalog;
    }
  }
  return flags;
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

function hasGeneratedEntry(entry: unknown): boolean {
  if (Array.isArray(entry)) {
    return entry.length > 0;
  }
  if (isCourseRequirementsV2(entry)) {
    return entry.global.length > 0 || entry.pathways.length > 0;
  }
  return false;
}

async function main() {
  const flags = parseFlags(process.argv);
  const catalogPaths = CATALOG_PATHS[flags.catalog];

  if (flags.stage === "validate") {
    const { spawnSync } = await import("node:child_process");
    const args = ["tsx", "scripts/parse-course-requirements-eval.ts"];
    if (flags.code) {
      args.push(`--code=${flags.code}`);
    }
    const result = spawnSync("npx", args, { cwd: repoRoot, stdio: "inherit" });
    process.exit(result.status ?? 1);
  }

  const rawData = JSON.parse(await readFile(catalogPaths.raw, "utf8")) as RawCatalog;
  const existing = JSON.parse(await readFile(catalogPaths.generated, "utf8")) as GeneratedFile;

  const baseCodeCounts: Record<string, number> = {};
  for (const course of rawData.courses) {
    const baseCode = slugify(course.course_name);
    baseCodeCounts[baseCode] = (baseCodeCounts[baseCode] ?? 0) + 1;
  }

  const targets = rawData.courses.filter((course) => {
    const code = buildCourseCode(course, baseCodeCounts);
    if (flags.code && code !== flags.code) return false;
    if (!flags.force && hasGeneratedEntry(existing.courses[code])) {
      return false;
    }
    return Boolean(course.entry_requirements?.trim());
  });

  console.log(
    `Found ${targets.length} courses to parse (catalog=${flags.catalog}, force=${flags.force}, dry=${flags.dry}, model=${flags.model}).`,
  );

  if (flags.dry) {
    for (const course of targets) {
      const code = buildCourseCode(course, baseCodeCounts);
      console.log(`  - ${code}: ${course.course_name} (${course.provider_name})`);
    }
    return;
  }

  if (targets.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set.");
  }

  const updated: Record<string, unknown> = { ...existing.courses };
  let successCount = 0;
  let failureCount = 0;

  for (const course of targets) {
    const code = buildCourseCode(course, baseCodeCounts);
    try {
      const result = await runExtractionPipeline({
        apiKey,
        model: flags.model,
        courseName: course.course_name,
        providerName: course.provider_name,
        entryText: course.entry_requirements ?? "",
      });
      updated[code] = result.v2;
      successCount += 1;
      const pathwayCount = result.v2.pathways.length;
      const leafCount =
        result.v2.global.length +
        result.v2.pathways.reduce((sum, pathway) => sum + pathway.requirements.length, 0);
      console.log(
        `  [ok]  ${code} (${pathwayCount} pathway${pathwayCount === 1 ? "" : "s"}, ${leafCount} leaves, ${result.stages.repairAttempts} repairs)`,
      );
    } catch (error) {
      failureCount += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  [fail] ${code}: ${message}`);
    }
  }

  const next: GeneratedFile = {
    version: 2,
    generatedAt: new Date().toISOString(),
    model: flags.model,
    courses: updated,
  };

  await writeFile(catalogPaths.generated, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  console.log(
    `\nWrote ${catalogPaths.generated}. ${successCount} succeeded, ${failureCount} failed.`,
  );
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
