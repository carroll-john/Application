#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const FIXTURE_ROOT = path.join(REPO_ROOT, "tests/fixtures/transcript-v3");
const MANIFEST_PATH = path.join(FIXTURE_ROOT, "manifest.json");
const REQUIREMENTS_PATH = path.join(
  REPO_ROOT,
  "src/lib/courseCatalog/requirements.generated.json",
);

const DEFAULT_BASE_URL = "http://127.0.0.1:4191";
const DEFAULT_TIMEOUT_MS = 180_000;
const SAFE_COURSE_CODE = "la-trobe-university-master-of-information-technology";
const SAFE_COURSE_TITLE = "Master of Information Technology";
const UNSAFE_COURSE_CODE = "master-of-business-marketing";
const UNSAFE_COURSE_TITLE = "Master of Business (Marketing)";

const VALID_OUTCOMES = new Set([
  "eligible",
  "conditionally_eligible",
  "ineligible",
  "insufficient_data",
]);

function parseArgs(argv) {
  const options = {
    baseUrl:
      process.env.TRANSCRIPT_ELIGIBILITY_BASE_URL?.trim() ||
      process.env.ELIGIBILITY_REGRESSION_BASE_URL?.trim() ||
      DEFAULT_BASE_URL,
    courseMode: "safe",
    fixtureIds: [],
    help: false,
    outDir: "",
    strict: false,
    timeoutMs: Number(
      process.env.TRANSCRIPT_ELIGIBILITY_TIMEOUT_MS || DEFAULT_TIMEOUT_MS,
    ),
    verbose: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--base-url") {
      options.baseUrl = argv[i + 1] || options.baseUrl;
      i += 1;
      continue;
    }

    if (arg === "--course-mode") {
      options.courseMode = argv[i + 1] === "unsafe" ? "unsafe" : "safe";
      i += 1;
      continue;
    }

    if (arg === "--fixture") {
      options.fixtureIds.push(argv[i + 1] || "");
      i += 1;
      continue;
    }

    if (arg === "--out-dir") {
      options.outDir = argv[i + 1] || options.outDir;
      i += 1;
      continue;
    }

    if (arg === "--timeout-ms") {
      options.timeoutMs = Number(argv[i + 1] || options.timeoutMs);
      i += 1;
      continue;
    }

    if (arg === "--strict") {
      options.strict = true;
      continue;
    }

    if (arg === "--verbose") {
      options.verbose = true;
      continue;
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage: npm run test:eligibility-transcripts -- [options]

Options:
  --base-url <url>       API base URL (default: ${DEFAULT_BASE_URL})
  --course-mode safe|unsafe   Matcher course (safe) or legacy fallback (unsafe)
  --fixture <id>         Run a single fixture id (repeatable)
  --out-dir <path>       Write results.json/csv here
  --timeout-ms <n>       Per-request timeout (default: ${DEFAULT_TIMEOUT_MS})
  --strict               Fail on soft outcome/institution mismatches
  --verbose              Print requirement rows for each fixture
`);
}

function normalizeRequirements(rawCourse) {
  if (!Array.isArray(rawCourse)) {
    return [];
  }

  return rawCourse.map((entry) => {
    const normalized = { ...entry };
    if (normalized.alternativeGroupId === null) {
      delete normalized.alternativeGroupId;
    }
    if (normalized.params && typeof normalized.params === "object") {
      const params = { ...normalized.params };
      for (const key of Object.keys(params)) {
        if (params[key] === null) {
          delete params[key];
        }
      }
      normalized.params = params;
    }
    return normalized;
  });
}

function isMatcherUnsafe(requirements) {
  let mandatoryQualificationCompleted = 0;
  let mandatoryFieldOfStudy = 0;
  const alternativeGroups = new Set();

  for (const requirement of requirements) {
    if (requirement.weight === "alternative" && requirement.alternativeGroupId) {
      alternativeGroups.add(requirement.alternativeGroupId);
      continue;
    }

    const isMandatory =
      requirement.weight === "mandatory" && !requirement.alternativeGroupId;
    if (!isMandatory) {
      continue;
    }

    if (requirement.kind === "qualification_completed") {
      mandatoryQualificationCompleted += 1;
    }
    if (requirement.kind === "field_of_study") {
      mandatoryFieldOfStudy += 1;
    }
  }

  return (
    mandatoryQualificationCompleted > 1 ||
    mandatoryFieldOfStudy > 1 ||
    alternativeGroups.size > 1
  );
}

async function loadEvaluationContext(courseMode) {
  if (courseMode === "unsafe") {
    return {
      completed: true,
      country: "Australia",
      courseCode: UNSAFE_COURSE_CODE,
      courseTitle: UNSAFE_COURSE_TITLE,
      institution: "Example University",
      level: "Bachelor Degree",
    };
  }

  const requirementsFile = JSON.parse(
    await fs.readFile(REQUIREMENTS_PATH, "utf8"),
  );
  const rawRequirements = requirementsFile.courses?.[SAFE_COURSE_CODE] ?? [];
  const requirements = normalizeRequirements(rawRequirements);

  if (requirements.length === 0 || isMatcherUnsafe(requirements)) {
    throw new Error(`Safe course ${SAFE_COURSE_CODE} has no matcher-safe requirements.`);
  }

  return {
    completed: true,
    country: "Australia",
    courseCode: SAFE_COURSE_CODE,
    courseTitle: SAFE_COURSE_TITLE,
    institution: "The University of Melbourne",
    level: "Bachelor Degree",
    requirements,
  };
}

function institutionKeyword(university) {
  const normalized = university.toLowerCase();
  const keywordByUniversity = [
    ["university of melbourne", "melbourne"],
    ["monash university", "monash"],
    ["university of sydney", "sydney"],
    ["university of new south wales", "new south wales"],
    ["rmit university", "rmit"],
    ["australian national university", "national"],
    ["university of western australia", "western australia"],
    ["university of queensland", "queensland"],
    ["university of tasmania", "tasmania"],
    ["deakin university", "deakin"],
    ["macquarie university", "macquarie"],
    ["queensland university of technology", "queensland university of technology"],
    ["university of technology sydney", "technology sydney"],
    ["griffith university", "griffith"],
  ];

  for (const [needle, keyword] of keywordByUniversity) {
    if (normalized.includes(needle)) {
      return keyword;
    }
  }

  const words = university.split(/\s+/).filter(Boolean);
  return words.length > 0 ? words[words.length - 1].toLowerCase() : normalized;
}

function readFieldValue(extractedGroup, fieldName) {
  const field = extractedGroup?.[fieldName];
  if (!field || typeof field !== "object") {
    return "";
  }
  const normalized =
    typeof field.normalizedValue === "string" ? field.normalizedValue.trim() : "";
  const original =
    typeof field.originalValue === "string" ? field.originalValue.trim() : "";
  return (normalized || original).toLowerCase();
}

function expectedOutcomeBucket(fixture) {
  const detail = fixture.qualification_achieved_detail.toLowerCase();
  const pendingOrIncomplete =
    !fixture.qualification_achieved &&
    (detail.includes("pending") ||
      detail.includes("current enrolment") ||
      detail.includes("not completed") ||
      detail.includes("requirements completed"));

  return fixture.qualification_achieved || pendingOrIncomplete
    ? "eligible_or_review"
    : "not_eligible";
}

function isOutcomeCompatible(outcome, bucket) {
  if (bucket === "eligible_or_review") {
    return outcome !== "ineligible";
  }
  return outcome === "ineligible" || outcome === "insufficient_data";
}

function duplicateRequirementIds(requirementsChecked) {
  const seen = new Set();
  const duplicates = [];

  for (const check of requirementsChecked) {
    if (typeof check?.id !== "string") {
      continue;
    }
    if (seen.has(check.id)) {
      duplicates.push(check.id);
    }
    seen.add(check.id);
  }

  return duplicates;
}

async function runFixtureCase({ baseUrl, context, fixture, timeoutMs, strict, verbose }) {
  const startedAt = Date.now();
  const pdfPath = path.join(FIXTURE_ROOT, fixture.file);
  const pdfBuffer = await fs.readFile(pdfPath);
  const fileName = path.basename(pdfPath);

  const perFixtureContext = {
    ...context,
    institution: fixture.university,
    completed: fixture.qualification_achieved,
  };

  const formData = new FormData();
  formData.append(
    "file",
    new Blob([pdfBuffer], { type: "application/pdf" }),
    fileName,
  );
  formData.append("context", JSON.stringify(perFixtureContext));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let status = 0;
  let payload = null;
  let networkError = "";

  try {
    const response = await fetch(
      `${baseUrl.replace(/\/$/, "")}/api/evaluate-transcript-eligibility`,
      {
        body: formData,
        method: "POST",
        signal: controller.signal,
      },
    );
    status = response.status;
    payload = await response.json();
  } catch (error) {
    networkError = error instanceof Error ? error.message : String(error);
  } finally {
    clearTimeout(timeout);
  }

  const elapsedSeconds = Number(((Date.now() - startedAt) / 1000).toFixed(2));
  const qualityErrors = [];

  if (status !== 200) {
    qualityErrors.push(
      payload?.error ||
        networkError ||
        `Expected HTTP 200, received ${status || "ERR"}.`,
    );
  }

  const outcome = typeof payload?.outcome === "string" ? payload.outcome : "";
  if (status === 200 && !VALID_OUTCOMES.has(outcome)) {
    qualityErrors.push(`Invalid outcome: ${outcome || "(missing)"}`);
  }

  const requirementsChecked = Array.isArray(payload?.requirementsChecked)
    ? payload.requirementsChecked
    : [];
  if (status === 200 && requirementsChecked.length === 0) {
    qualityErrors.push("Expected at least one requirementsChecked row.");
  }

  const duplicates = duplicateRequirementIds(requirementsChecked);
  if (duplicates.length > 0) {
    qualityErrors.push(`Duplicate requirement ids: ${duplicates.join(", ")}`);
  }

  const institutionValue = readFieldValue(
    payload?.extractedData?.applicantDetails,
    "institutionName",
  );
  const keyword = institutionKeyword(fixture.university);
  if (status === 200 && keyword && !institutionValue.includes(keyword)) {
    const message = `Institution mismatch: expected keyword "${keyword}", got "${institutionValue || "(empty)"}".`;
    if (strict) {
      qualityErrors.push(message);
    }
  }

  const bucket = expectedOutcomeBucket(fixture);
  if (status === 200 && strict && !isOutcomeCompatible(outcome, bucket)) {
    qualityErrors.push(
      `Outcome ${outcome} incompatible with bucket ${bucket} for ${fixture.fixture_id}.`,
    );
  }

  if (verbose && status === 200) {
    console.log(`\n${fixture.fixture_id} rows:`);
    for (const check of requirementsChecked) {
      console.log(`  - ${check.id}: ${check.status} | ${check.requirement}`);
    }
  }

  return {
    elapsedSeconds,
    error: qualityErrors[0] || "",
    file: pdfPath,
    fixtureId: fixture.fixture_id,
    institutionExtracted: institutionValue,
    outcome,
    passed: status === 200 && qualityErrors.length === 0,
    requirementCount: requirementsChecked.length,
    rulesVersion: payload?.rulesVersion ?? null,
    status: status || "ERR",
    university: fixture.university,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, "utf8"));
  let fixtures = Array.isArray(manifest.fixtures) ? manifest.fixtures : [];

  if (options.fixtureIds.length > 0) {
    const wanted = new Set(options.fixtureIds.filter(Boolean));
    fixtures = fixtures.filter((fixture) => wanted.has(fixture.fixture_id));
  }

  if (fixtures.length === 0) {
    throw new Error("No transcript fixtures selected.");
  }

  const context = await loadEvaluationContext(options.courseMode);
  const outDir =
    options.outDir ||
    path.join(
      REPO_ROOT,
      ".tmp",
      `eligibility-transcript-regression-${Date.now()}`,
    );
  await fs.mkdir(outDir, { recursive: true });

  const results = [];
  for (const fixture of fixtures) {
    results.push(
      await runFixtureCase({
        baseUrl: options.baseUrl,
        context,
        fixture,
        strict: options.strict,
        timeoutMs: options.timeoutMs,
        verbose: options.verbose,
      }),
    );
  }

  const resultsPath = path.join(outDir, "results.json");
  await fs.writeFile(resultsPath, `${JSON.stringify(results, null, 2)}\n`, "utf8");

  const passed = results.filter((result) => result.passed);
  const failed = results.filter((result) => !result.passed);

  console.log(
    `Transcript eligibility regression (${options.baseUrl}, course=${options.courseMode})`,
  );
  console.log(`Fixtures: ${results.length} | Passed: ${passed.length} | Failed: ${failed.length}`);
  console.log(`Output: ${outDir}`);

  for (const result of results) {
    const label = result.passed ? "PASS" : "FAIL";
    console.log(
      `[${label}] ${result.fixtureId} | status=${result.status} | ${result.elapsedSeconds}s | outcome=${result.outcome || "-"} | rows=${result.requirementCount}${result.rulesVersion ? ` | rules=${result.rulesVersion}` : ""}`,
    );
    if (!result.passed && result.error) {
      console.log(`       error: ${result.error}`);
    }
  }

  console.log(`\nJSON: ${pathToFileURL(resultsPath).href}`);

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(
    `Transcript eligibility regression failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
