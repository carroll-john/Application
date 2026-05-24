#!/usr/bin/env tsx
/**
 * Offline parser: turns each course's `entry_requirements` natural-language text into a structured
 * `RequirementInstance[]` and writes the result to `src/lib/courseCatalog/requirements.generated.json`.
 *
 * This script is run by humans (or CI) when the course catalog changes — it is NOT invoked at
 * application runtime. The generated JSON is committed to the repo and reviewed in PRs.
 *
 * Usage:
 *   OPENAI_API_KEY=... tsx scripts/parse-course-requirements.ts
 *   OPENAI_API_KEY=... tsx scripts/parse-course-requirements.ts --code=mit-online
 *   OPENAI_API_KEY=... tsx scripts/parse-course-requirements.ts --force            # re-parse all
 *   tsx scripts/parse-course-requirements.ts --dry                                  # no API calls, no writes
 *
 * Flags:
 *   --code=<courseCode>   Parse only the named course code (matches the catalog `code` field).
 *   --force               Re-parse courses even if they already have generated requirements.
 *   --dry                 Print the planned work, do not call OpenAI, do not write the file.
 *   --model=<name>        Override the OpenAI model (default: gpt-4.1-mini).
 */

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = resolve(__filename, "../..");

const RAW_CATALOG_PATH = resolve(repoRoot, "src/data/courses.raw.json");
const GENERATED_PATH = resolve(repoRoot, "src/lib/courseCatalog/requirements.generated.json");
const DEFAULT_MODEL = "gpt-4.1-mini";
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

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
  courses: Record<string, unknown[]>;
}

interface ParseFlags {
  code?: string;
  force: boolean;
  dry: boolean;
  model: string;
}

function parseFlags(argv: string[]): ParseFlags {
  const flags: ParseFlags = { force: false, dry: false, model: DEFAULT_MODEL };
  for (const arg of argv.slice(2)) {
    if (arg === "--force") flags.force = true;
    else if (arg === "--dry") flags.dry = true;
    else if (arg.startsWith("--code=")) flags.code = arg.slice("--code=".length);
    else if (arg.startsWith("--model=")) flags.model = arg.slice("--model=".length);
  }
  return flags;
}

// Slugify mirrors the runtime course-code construction in src/lib/courseCatalog/slugify.ts. We replicate
// it here rather than import to keep this script independent of the Vite/TS build graph.
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

const PARSER_INSTRUCTIONS = `You convert university course entry-requirement text into structured RequirementInstance objects.

Allowed kinds (exhaustive):
  - qualification_completed: applicant must have completed the prior qualification. params: {}.
  - qualification_level: minimum prior qualification level. params: { level: "high_school" | "diploma" | "bachelor" | "honours" | "masters" | "doctorate" }.
  - academic_threshold: minimum WAM or GPA. params: { metric: "wam" | "gpa", min: number, scale?: number }.
  - english_proficiency: English language requirement. params: { acceptedPathways: [...] }.
      Pathway types:
        { type: "completion_in_country", countries: ISO 3166-1 alpha-2 string[] }
        { type: "english_test", test: "IELTS" | "TOEFL_iBT" | "PTE" | "CAE" | "OET", minOverall: number, minBand?: number }
  - work_experience: minimum years of relevant work experience. params: { minYears: number, relevantTo?: string }.
  - field_of_study: prior study must be in an accepted field. params: { acceptedAreas: string[] }.

Rules:
  - Output one RequirementInstance per atomic requirement. Do not combine multiple thresholds into one object.
  - Use the verbatim sentence(s) from the entry requirements as sourceText (trim whitespace, no paraphrasing).
  - weight: "mandatory" unless the requirement is genuinely interchangeable with another (an OR/either pathway).
  - alternativeGroupId: ONLY set this on requirements whose weight is "alternative" AND that are interchangeable with at least one other emitted requirement (satisfying ANY one of them satisfies the group). Otherwise set it to null. Do not use the group id as a structural label for related-but-mandatory requirements (e.g. bachelor + WAM + work experience that ALL must be met share NO alternativeGroupId — each is mandatory and standalone).
  - Never emit a single-member alternative group. If you would tag a requirement as "alternative" but cannot find another listed requirement that is a genuine OR-equivalent, instead either (a) skip the requirement entirely, or (b) emit it as mandatory if it truly is required. "Considered for professional entry without a degree" type clauses that describe a separate ad-hoc entry pathway should be SKIPPED — they are not matchable.
  - id: use a kebab-case, course-stable identifier (e.g. "wam-65", "completed-bachelor", "english-ielts").
  - For Australian-context courses, when the entry text says "or equivalent" or "or completion in English", include an english_proficiency requirement with at least the completion_in_country pathway listing recognised English-medium countries (default: AU, NZ, UK, IE, US, CA, ZA) unless the course explicitly narrows the list.
  - If the entry requirement text does not contain a particular kind, do NOT invent one. Only emit kinds explicitly evidenced.
  - If the text mentions "Bachelor degree (or equivalent)" treat it as qualification_level: bachelor AND qualification_completed.
  - If the entry text is too vague to extract any structured requirement, return an empty array.

Return ONLY the JSON object specified by the response schema.`;

function buildSchema() {
  // OpenAI structured outputs require additionalProperties:false everywhere with `strict: true`.
  // We use anyOf over per-kind variants so each instance carries the right param shape.
  const pathway = {
    anyOf: [
      {
        type: "object",
        additionalProperties: false,
        required: ["type", "countries"],
        properties: {
          type: { type: "string", enum: ["completion_in_country"] },
          countries: { type: "array", items: { type: "string" } },
        },
      },
      {
        type: "object",
        additionalProperties: false,
        required: ["type", "test", "minOverall", "minBand"],
        properties: {
          type: { type: "string", enum: ["english_test"] },
          test: { type: "string", enum: ["IELTS", "TOEFL_iBT", "PTE", "CAE", "OET"] },
          minOverall: { type: "number" },
          minBand: { type: ["number", "null"] },
        },
      },
    ],
  };

  const instance = {
    type: "object",
    additionalProperties: false,
    required: ["id", "kind", "params", "sourceText", "weight", "alternativeGroupId"],
    properties: {
      id: { type: "string" },
      kind: {
        type: "string",
        enum: [
          "qualification_completed",
          "qualification_level",
          "academic_threshold",
          "english_proficiency",
          "work_experience",
          "field_of_study",
        ],
      },
      params: {
        anyOf: [
          { type: "object", additionalProperties: false, required: [], properties: {} },
          {
            type: "object",
            additionalProperties: false,
            required: ["level"],
            properties: {
              level: {
                type: "string",
                enum: ["high_school", "diploma", "bachelor", "honours", "masters", "doctorate"],
              },
            },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["metric", "min", "scale"],
            properties: {
              metric: { type: "string", enum: ["wam", "gpa"] },
              min: { type: "number" },
              scale: { type: ["number", "null"] },
            },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["acceptedPathways"],
            properties: {
              acceptedPathways: { type: "array", items: pathway },
            },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["minYears", "relevantTo"],
            properties: {
              minYears: { type: "number" },
              relevantTo: { type: ["string", "null"] },
            },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["acceptedAreas"],
            properties: {
              acceptedAreas: { type: "array", items: { type: "string" } },
            },
          },
        ],
      },
      sourceText: { type: "string" },
      weight: { type: "string", enum: ["mandatory", "alternative"] },
      alternativeGroupId: { type: ["string", "null"] },
    },
  };

  return {
    type: "object",
    additionalProperties: false,
    required: ["requirements"],
    properties: {
      requirements: { type: "array", items: instance },
    },
  };
}

async function parseOneCourse(
  course: RawCourseEntry,
  apiKey: string,
  model: string,
): Promise<unknown[]> {
  const entryText = (course.entry_requirements ?? "").trim();
  if (!entryText) {
    return [];
  }

  const body = {
    model,
    max_output_tokens: 2000,
    instructions: PARSER_INSTRUCTIONS,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Course: ${course.course_name}\nProvider: ${course.provider_name}\n\nEntry requirements text:\n${entryText}`,
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "course_requirements",
        strict: true,
        schema: buildSchema(),
      },
    },
  };

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "(no body)");
    throw new Error(`OpenAI request failed (${response.status}): ${text.slice(0, 400)}`);
  }

  const payload = (await response.json()) as {
    output_parsed?: { requirements?: unknown[] };
    output_text?: string;
    output?: Array<{ content?: Array<{ parsed?: { requirements?: unknown[] }; text?: string }> }>;
  };

  if (payload.output_parsed?.requirements) {
    return payload.output_parsed.requirements;
  }

  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    try {
      const parsed = JSON.parse(payload.output_text) as { requirements?: unknown[] };
      if (Array.isArray(parsed.requirements)) {
        return parsed.requirements;
      }
    } catch {
      // fall through to output[] walk
    }
  }

  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.parsed?.requirements) {
        return content.parsed.requirements;
      }
      if (typeof content.text === "string" && content.text.trim()) {
        try {
          const parsed = JSON.parse(content.text) as { requirements?: unknown[] };
          if (Array.isArray(parsed.requirements)) {
            return parsed.requirements;
          }
        } catch {
          // ignore and try next content block
        }
      }
    }
  }

  throw new Error("OpenAI response did not contain a `requirements` array.");
}

async function main() {
  const flags = parseFlags(process.argv);
  const rawData = JSON.parse(await readFile(RAW_CATALOG_PATH, "utf8")) as RawCatalog;
  const existing = JSON.parse(await readFile(GENERATED_PATH, "utf8")) as GeneratedFile;

  const baseCodeCounts: Record<string, number> = {};
  for (const course of rawData.courses) {
    const baseCode = slugify(course.course_name);
    baseCodeCounts[baseCode] = (baseCodeCounts[baseCode] ?? 0) + 1;
  }

  const targets = rawData.courses.filter((course) => {
    const code = buildCourseCode(course, baseCodeCounts);
    if (flags.code && code !== flags.code) return false;
    if (!flags.force && Array.isArray(existing.courses[code]) && existing.courses[code].length > 0) {
      return false;
    }
    return Boolean(course.entry_requirements?.trim());
  });

  console.log(
    `Found ${targets.length} courses to parse (force=${flags.force}, dry=${flags.dry}, model=${flags.model}).`,
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

  const updated: Record<string, unknown[]> = { ...existing.courses };
  let successCount = 0;
  let failureCount = 0;

  for (const course of targets) {
    const code = buildCourseCode(course, baseCodeCounts);
    try {
      const requirements = await parseOneCourse(course, apiKey, flags.model);
      updated[code] = requirements;
      successCount += 1;
      console.log(`  [ok]  ${code} (${requirements.length} requirement${requirements.length === 1 ? "" : "s"})`);
    } catch (error) {
      failureCount += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  [fail] ${code}: ${message}`);
    }
  }

  const next: GeneratedFile = {
    version: existing.version ?? 1,
    generatedAt: new Date().toISOString(),
    model: flags.model,
    courses: updated,
  };

  await writeFile(GENERATED_PATH, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  console.log(`\nWrote ${GENERATED_PATH}. ${successCount} succeeded, ${failureCount} failed.`);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
