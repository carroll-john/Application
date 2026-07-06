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
const DEFAULT_CONCURRENCY = 1;
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
    compare: null,
    concurrency: Number(
      process.env.TRANSCRIPT_ELIGIBILITY_CONCURRENCY || DEFAULT_CONCURRENCY,
    ),
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

    if (arg === "--compare") {
      options.compare = [argv[i + 1] || "", argv[i + 2] || ""];
      i += 2;
      continue;
    }

    if (arg === "--concurrency") {
      options.concurrency = Number(argv[i + 1] || options.concurrency);
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
  --compare <a> <b>      Diff two previous runs' scorecard.json files and exit
  --concurrency <n>      Run up to n fixtures in parallel (default: ${DEFAULT_CONCURRENCY})
  --course-mode safe|unsafe   Matcher course (safe) or legacy fallback (unsafe)
  --fixture <id>         Run a single fixture id (repeatable)
  --out-dir <path>       Write results.json + scorecard.json here
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

function resolveEvidenceSource(payload) {
  if (
    payload &&
    typeof payload === "object" &&
    payload.extractedData &&
    typeof payload.extractedData === "object" &&
    !Array.isArray(payload.extractedData)
  ) {
    return payload.extractedData;
  }
  return payload;
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

/**
 * Internal-consistency invariants that must hold for every response regardless of transcript
 * content. These are the guarantees that keep the UI's header, cards, bullets, and next step from
 * contradicting each other. Violations are hard failures (not gated behind --strict).
 */
function consistencyInvariantViolations(payload) {
  const violations = [];
  const checks = Array.isArray(payload?.requirementsChecked) ? payload.requirementsChecked : [];
  const missingInformation = Array.isArray(payload?.missingInformation)
    ? payload.missingInformation
    : [];
  const pendingEvidence = Array.isArray(payload?.pendingEvidence) ? payload.pendingEvidence : [];

  // A bullet can never restate a passed requirement's explanation.
  for (const check of checks) {
    if (check?.status === "pass" && missingInformation.includes(check.explanation)) {
      violations.push(
        `missingInformation contains the explanation of passed check "${check.id}".`,
      );
    }
  }

  // An eligible verdict cannot carry missing-information bullets.
  if (payload?.outcome === "eligible" && missingInformation.length > 0) {
    violations.push(
      `outcome is eligible but missingInformation has ${missingInformation.length} item(s).`,
    );
  }

  // Pending evidence must only reference unknown checks and never transcript-scoped ones.
  const checkById = new Map(checks.map((check) => [check.id, check]));
  for (const pending of pendingEvidence) {
    const check = checkById.get(pending.requirementId);
    if (check && check.status !== "unknown") {
      violations.push(
        `pendingEvidence references check "${pending.requirementId}" with status ${check.status}.`,
      );
    }
    if (pending.evidenceSource === "transcript") {
      violations.push(
        `pendingEvidence entry "${pending.requirementId}" claims transcript as its evidence source.`,
      );
    }
  }

  if (typeof payload?.recommendedNextStep !== "string" || !payload.recommendedNextStep.trim()) {
    violations.push("recommendedNextStep is empty.");
  }

  return violations;
}

function readManifestWam(fixture) {
  if (!Array.isArray(fixture.metrics)) {
    return undefined;
  }
  for (const metric of fixture.metrics) {
    if (Array.isArray(metric) && /weighted average|wam/i.test(String(metric[0]))) {
      const parsed = Number.parseFloat(String(metric[1]));
      return Number.isFinite(parsed) ? parsed : undefined;
    }
  }
  return undefined;
}

/**
 * Per-field extraction scores against the manifest's ground-truth labels. `null` means the
 * manifest has no ground truth for that field on this fixture (excluded from accuracy).
 */
function scoreExtraction(payload, fixture) {
  const evidence = resolveEvidenceSource(payload);

  const completionText = readFieldValue(evidence?.studyDetails, "completionStatus").replace(
    /_/g,
    " ",
  );
  let completionCorrect = null;
  if (completionText) {
    const extractedCompleted =
      /\b(completed|conferred|graduated|awarded)\b/.test(completionText) &&
      !/\b(not completed|in progress|withdrawn|discontinued|excluded)\b/.test(completionText);
    completionCorrect = extractedCompleted === Boolean(fixture.qualification_achieved);
  } else {
    completionCorrect = false;
  }

  const expectedWam = readManifestWam(fixture);
  let wamCorrect = null;
  if (expectedWam !== undefined) {
    const extractedWamText = readFieldValue(evidence?.academicPerformance, "gradeAverageOrWam");
    const extractedWam = Number.parseFloat(extractedWamText.replace(/[^\d.]/g, " "));
    wamCorrect = Number.isFinite(extractedWam) && Math.abs(extractedWam - expectedWam) <= 0.05;
  }

  const institutionValue = readFieldValue(evidence?.applicantDetails, "institutionName");
  const keyword = institutionKeyword(fixture.university);
  const institutionCorrect = keyword ? institutionValue.includes(keyword) : null;

  return { completionCorrect, institutionCorrect, wamCorrect };
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

/**
 * Run mapper over items with a fixed worker pool. Results keep input order.
 */
async function mapWithConcurrency(items, concurrency, mapper) {
  if (items.length === 0) {
    return [];
  }

  const limit = Math.max(1, Math.floor(concurrency));
  if (limit === 1) {
    const results = [];
    for (const [index, item] of items.entries()) {
      results.push(await mapper(item, index));
    }
    return results;
  }

  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) {
        return;
      }
      results[index] = await mapper(items[index], index);
    }
  }

  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
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

  const invariantViolations = status === 200 ? consistencyInvariantViolations(payload) : [];
  for (const violation of invariantViolations) {
    qualityErrors.push(`Consistency invariant violated: ${violation}`);
  }

  const extraction = status === 200 ? scoreExtraction(payload, fixture) : null;

  const institutionValue = readFieldValue(
    resolveEvidenceSource(payload)?.applicantDetails,
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
    extraction,
    file: pdfPath,
    fixtureId: fixture.fixture_id,
    institutionExtracted: institutionValue,
    invariantViolations,
    modelId: payload?.modelId ?? null,
    outcome,
    passed: status === 200 && qualityErrors.length === 0,
    promptVersion: payload?.promptVersion ?? null,
    requirementCount: requirementsChecked.length,
    rulesVersion: payload?.rulesVersion ?? null,
    schemaVersion: payload?.schemaVersion ?? null,
    status: status || "ERR",
    university: fixture.university,
  };
}

function accuracy(results, field) {
  let correct = 0;
  let total = 0;
  for (const result of results) {
    const score = result.extraction?.[field];
    if (score === null || score === undefined) {
      continue;
    }
    total += 1;
    if (score === true) {
      correct += 1;
    }
  }
  return { correct, rate: total > 0 ? Number((correct / total).toFixed(3)) : null, total };
}

/**
 * Aggregated, comparable summary of a run. Stamped with the exact (model, prompt, schema, rules)
 * tuple so two scorecards can be diffed to A/B a model or prompt change (--compare).
 */
function buildScorecard(results, options) {
  const firstVersioned = results.find((result) => result.rulesVersion || result.promptVersion);
  return {
    baseUrl: options.baseUrl,
    courseMode: options.courseMode,
    extractionAccuracy: {
      completion: accuracy(results, "completionCorrect"),
      institution: accuracy(results, "institutionCorrect"),
      wam: accuracy(results, "wamCorrect"),
    },
    fixtures: results.length,
    generatedAt: new Date().toISOString(),
    invariantViolations: results.reduce(
      (sum, result) => sum + (result.invariantViolations?.length ?? 0),
      0,
    ),
    meanElapsedSeconds: Number(
      (
        results.reduce((sum, result) => sum + (result.elapsedSeconds || 0), 0) /
        Math.max(results.length, 1)
      ).toFixed(2),
    ),
    passed: results.filter((result) => result.passed).length,
    versions: {
      modelId: firstVersioned?.modelId ?? null,
      promptVersion: firstVersioned?.promptVersion ?? null,
      rulesVersion: firstVersioned?.rulesVersion ?? null,
      schemaVersion: firstVersioned?.schemaVersion ?? null,
    },
  };
}

async function readScorecard(runPath) {
  const direct = runPath.endsWith(".json") ? runPath : path.join(runPath, "scorecard.json");
  return JSON.parse(await fs.readFile(direct, "utf8"));
}

function formatRate(entry) {
  if (!entry || entry.rate === null) {
    return "n/a";
  }
  return `${(entry.rate * 100).toFixed(1)}% (${entry.correct}/${entry.total})`;
}

async function compareScorecards(pathA, pathB) {
  const [a, b] = await Promise.all([readScorecard(pathA), readScorecard(pathB)]);
  const versionLine = (card) =>
    `model=${card.versions?.modelId ?? "?"} prompt=${card.versions?.promptVersion ?? "?"} schema=${card.versions?.schemaVersion ?? "?"} rules=${card.versions?.rulesVersion ?? "?"}`;

  console.log("Scorecard comparison");
  console.log(`A: ${pathA}\n   ${versionLine(a)} | ${a.generatedAt}`);
  console.log(`B: ${pathB}\n   ${versionLine(b)} | ${b.generatedAt}`);
  console.log("");
  console.log(`Pass rate:            A ${a.passed}/${a.fixtures}  vs  B ${b.passed}/${b.fixtures}`);
  console.log(`Invariant violations: A ${a.invariantViolations}  vs  B ${b.invariantViolations}`);
  console.log(`Mean latency (s):     A ${a.meanElapsedSeconds}  vs  B ${b.meanElapsedSeconds}`);
  for (const field of ["completion", "wam", "institution"]) {
    console.log(
      `Extraction ${field.padEnd(11)}: A ${formatRate(a.extractionAccuracy?.[field])}  vs  B ${formatRate(b.extractionAccuracy?.[field])}`,
    );
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  if (options.compare) {
    await compareScorecards(options.compare[0], options.compare[1]);
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

  if (!Number.isFinite(options.concurrency) || options.concurrency < 1) {
    throw new Error("`--concurrency` must be a positive integer.");
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

  const runStartedAt = Date.now();
  const results = await mapWithConcurrency(
    fixtures,
    options.concurrency,
    (fixture) =>
      runFixtureCase({
        baseUrl: options.baseUrl,
        context,
        fixture,
        strict: options.strict,
        timeoutMs: options.timeoutMs,
        verbose: options.verbose,
      }),
  );
  const wallElapsedSeconds = Number(((Date.now() - runStartedAt) / 1000).toFixed(2));

  const resultsPath = path.join(outDir, "results.json");
  await fs.writeFile(resultsPath, `${JSON.stringify(results, null, 2)}\n`, "utf8");

  const scorecard = buildScorecard(results, options);
  const scorecardPath = path.join(outDir, "scorecard.json");
  await fs.writeFile(scorecardPath, `${JSON.stringify(scorecard, null, 2)}\n`, "utf8");

  const passed = results.filter((result) => result.passed);
  const failed = results.filter((result) => !result.passed);

  console.log(
    `Transcript eligibility regression (${options.baseUrl}, course=${options.courseMode}, concurrency=${options.concurrency})`,
  );
  console.log(
    `Fixtures: ${results.length} | Passed: ${passed.length} | Failed: ${failed.length} | Wall time: ${wallElapsedSeconds}s`,
  );
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

  console.log(
    `\nExtraction accuracy: completion ${formatRate(scorecard.extractionAccuracy.completion)} | wam ${formatRate(scorecard.extractionAccuracy.wam)} | institution ${formatRate(scorecard.extractionAccuracy.institution)}`,
  );
  console.log(`Versions: ${JSON.stringify(scorecard.versions)}`);
  console.log(`\nJSON: ${pathToFileURL(resultsPath).href}`);
  console.log(`Scorecard: ${pathToFileURL(scorecardPath).href}`);

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
