#!/usr/bin/env node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const DEFAULT_BASE_URL = "http://127.0.0.1:4190";
const DEFAULT_TIMEOUT_MS = 180_000;

const MIME_BY_EXTENSION = {
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  txt: "text/plain",
};

const TEXT_FIXTURES = {
  "cv01_chronological.txt": `Alex Morgan
Email: alex.morgan@example.com

PROFESSIONAL EXPERIENCE
Head of Product, Lumina Health (Full-time)
July 2023 - Present
- Leading product strategy across web and mobile care journeys.
- Managing a team of 9 across product, design and analytics.

Principal Product Manager, BrightPath Learning (Full-time)
March 2021 - June 2023
- Owned roadmap, pricing tests and conversion optimization.
- Delivered onboarding redesign that increased activation 18%.

Senior Business Analyst, Harbor Insurance (Contract)
January 2018 - February 2021
- Led discovery workshops and authored delivery requirements.
`,
  "cv02_functional.txt": `SAMUEL KIM
Summary
Product and UX leader with 12 years in education technology.

Core Strengths
- Product strategy
- Customer research
- Experimentation

Work History
2022 to Present | SEEK Learning | Head of Product and UX | Full-time
Responsibilities: Define annual product plan, coach PMs, align with data science.

2020 to 2022 | SEEK Learning | Senior Product Manager | Full-time
Responsibilities: Built growth experiments and lifecycle messaging.

2017 to 2020 | Open Universities Australia | Product Manager | Full-time
Responsibilities: Owned enrolment funnel and conversion analytics.
`,
  "cv03_compact_dates.txt": `Jordan Lee

Experience
Product Director | Nova Systems | 2024-02 to Present
Duties: Own platform strategy, partner with engineering and GTM.

Product Manager | Nova Systems | 2021-06 to 2024-01
Duties: Managed roadmap and quarterly planning.

Business Analyst | ClearView Finance | 09/2018 - 05/2021
Duties: Requirement gathering, sprint planning, UAT coordination.
`,
  "cv04_table_style.txt": `Taylor Patel

EMPLOYMENT RECORD
| Company              | Role                               | Dates              | Type      |
|----------------------|------------------------------------|--------------------|-----------|
| Greenline Logistics  | Product Lead                       | Jan 2023 - Present | Full-time |
| Greenline Logistics  | Senior Product Manager             | Apr 2021 - Dec 2022| Full-time |
| Southport Digital    | Product Manager                    | 2018 - 2021        | Contract  |

Role notes
Greenline Logistics Product Lead: Leading B2B shipment visibility product.
Southport Digital Product Manager: Delivered client portals and reporting.
`,
  "cv05_mixed_bullets.txt": `Riley Chen

Experience
SEEK (Head of Product & UX) [Current]
Start: July 2023
What I do:
* growth strategy across web/mobile/offline
* organisational change across Product, UX, Content, Data

SEEK Learning (Principal Product & UX Manager)
Start: October 2021
End: September 2022
What I did:
* led discovery + delivery across product portfolio

SEEK Learning (Product Manager)
Start: April 2018
End: February 2021
What I did:
* launched greenfield product
`,
  "cv06_sparse_info.txt": `Casey Nguyen

Employment
- Product Lead at Orbit, current role.
- Before that Product Manager at Orbit for around 2 years.
- Earlier BA at Atlas from 2017 to 2019.

Other
Happy to provide references.
`,
  "cv07_nonstandard_headings.txt": `Mia Johnson

Career Timeline
Now -> Aug 2022 : Beacon Health : Director of Product
- Own strategy, lead PM group, drive operating cadence.

Jul 2022 -> Jan 2020 : Beacon Health : Senior Product Manager
- Lifecycle redesign, analytics instrumentation, pricing tests.

2019 -> 2016 : Union Mutual : Agile BA / Iteration Manager
- Roadmap support, workshops, backlog and acceptance criteria.
`,
  "cv08_long_form.txt": `Noah Williams

Professional Profile
Noah has extensive experience in online education and digital product management.

Employment Experience
Head of Product and UX, StudyHub Group, Full-time, January 2024 - Present.
In this role Noah oversees platform strategy, quarterly planning, hiring, and coaching for product teams.
He coordinates cross-functional delivery and stakeholder communications.

Principal Product Manager, StudyHub Group, Full-time, February 2022 - December 2023.
Noah led product discovery and delivery for customer acquisition and retention initiatives.
He managed a team of five product managers.

Senior Product Manager, Open Campus Network, Contract, March 2019 - January 2022.
Noah directed roadmap prioritization and experimentation programs.
`,
};

const MIN_EXPERIENCES_BY_FIXTURE = new Map([
  ["cv02_functional.txt", 2],
  ["cv05_mixed_bullets.txt", 2],
  ["cv09_functional.docx", 2],
  ["cv10_mixed_bullets.docx", 2],
]);

const MIN_UNIQUE_POSITIONS_BY_FIXTURE = new Map([
  ["cv02_functional.txt", 2],
  ["cv05_mixed_bullets.txt", 2],
  ["cv09_functional.docx", 2],
  ["cv10_mixed_bullets.docx", 2],
]);

function parseArgs(argv) {
  const options = {
    baseUrl: process.env.CV_PARSER_BASE_URL?.trim() || DEFAULT_BASE_URL,
    strict: true,
    timeoutMs: Number(process.env.CV_PARSER_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
    userFiles: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--base-url") {
      options.baseUrl = argv[i + 1] || options.baseUrl;
      i += 1;
      continue;
    }

    if (arg === "--timeout-ms") {
      options.timeoutMs = Number(argv[i + 1] || options.timeoutMs);
      i += 1;
      continue;
    }

    if (arg === "--out-dir") {
      options.outDir = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === "--file") {
      const next = argv[i + 1];
      if (next) {
        options.userFiles.push(next);
      }
      i += 1;
      continue;
    }

    if (arg === "--no-strict") {
      options.strict = false;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      options.help = true;
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage: npm run test:cv-parser -- [options]

Options:
  --base-url <url>      Parser host (default: ${DEFAULT_BASE_URL})
  --timeout-ms <ms>     Per-file timeout in milliseconds (default: ${DEFAULT_TIMEOUT_MS})
  --out-dir <path>      Output directory (default: /tmp/cv-parser-regression-<timestamp>)
  --file <path>         Additional CV file to include (repeatable)
  --no-strict           Exit 0 even if failures occur
  --help                Show this help
`);
}

function commandExists(command) {
  const result = spawnSync("which", [command], { encoding: "utf8" });
  return result.status === 0;
}

function toCsvRow(values) {
  return values
    .map((value) => {
      const text = value == null ? "" : String(value);
      if (/[",\n]/.test(text)) {
        return `"${text.replace(/"/g, "\"\"")}"`;
      }
      return text;
    })
    .join(",");
}

function relativeOrSelf(target, parent) {
  try {
    return path.relative(parent, target) || ".";
  } catch {
    return target;
  }
}

async function writeTextFixtures(fixturesDir) {
  const paths = [];

  for (const [name, body] of Object.entries(TEXT_FIXTURES)) {
    const target = path.join(fixturesDir, name);
    await fs.writeFile(target, `${body.trim()}\n`, "utf8");
    paths.push(target);
  }

  return paths;
}

async function createDocxFixtures(fixturesDir, txtPaths, warnings) {
  if (!commandExists("textutil")) {
    warnings.push("Skipped DOCX fixture generation: `textutil` not found.");
    return [];
  }

  const selected = [
    txtPaths.find((p) => p.endsWith("cv02_functional.txt")),
    txtPaths.find((p) => p.endsWith("cv05_mixed_bullets.txt")),
  ].filter(Boolean);

  const outputs = [];
  for (const source of selected) {
    const output = source.replace(/\.txt$/i, ".docx").replace("cv02_", "cv09_").replace("cv05_", "cv10_");
    const result = spawnSync("textutil", ["-convert", "docx", source, "-output", output], {
      encoding: "utf8",
    });

    if (result.status !== 0) {
      warnings.push(
        `DOCX generation failed for ${path.basename(source)}: ${result.stderr || result.stdout || "unknown error"}`,
      );
      continue;
    }

    outputs.push(output);
  }

  return outputs;
}

async function createPdfFixtures(fixturesDir, txtPaths, warnings) {
  if (!commandExists("cupsfilter")) {
    warnings.push("Skipped PDF fixture generation: `cupsfilter` not found.");
    return [];
  }

  const selected = [
    txtPaths.find((p) => p.endsWith("cv01_chronological.txt")),
    txtPaths.find((p) => p.endsWith("cv07_nonstandard_headings.txt")),
  ].filter(Boolean);

  const outputs = [];
  for (const source of selected) {
    const output = source
      .replace(/\.txt$/i, ".pdf")
      .replace("cv01_", "cv11_")
      .replace("cv07_", "cv12_");

    const result = spawnSync(
      "cupsfilter",
      ["-m", "application/pdf", source],
      { encoding: null },
    );

    if (result.status !== 0 || !result.stdout) {
      warnings.push(
        `PDF generation failed for ${path.basename(source)}: ${result.stderr?.toString("utf8") || "unknown error"}`,
      );
      continue;
    }

    await fs.writeFile(output, result.stdout);
    outputs.push(output);
  }

  return outputs;
}

function mimeTypeFor(filePath) {
  const extension = path.extname(filePath).replace(".", "").toLowerCase();
  return MIME_BY_EXTENSION[extension] || "application/octet-stream";
}

async function ensureFileExists(filePath, warnings) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    warnings.push(`Skipped missing file: ${filePath}`);
    return false;
  }
}

async function runParserCase({ baseUrl, filePath, timeoutMs }) {
  const startedAt = Date.now();
  const name = path.basename(filePath);
  const mimeType = mimeTypeFor(filePath);

  let status = 0;
  let payload = null;
  let rawText = "";
  let networkError = null;

  try {
    const marker = "__HTTP_STATUS__";
    const request = spawnSync(
      "curl",
      [
        "-sS",
        "--max-time",
        String(Math.max(1, Math.floor(timeoutMs / 1000))),
        "-X",
        "POST",
        "-F",
        `file=@${filePath};type=${mimeType}`,
        "-w",
        `\\n${marker}%{http_code}`,
        `${baseUrl}/api/parse-cv`,
      ],
      { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
    );

    if (request.error) {
      networkError = request.error.message;
    } else if (request.status !== 0) {
      networkError = request.stderr?.trim() || "curl request failed";
    }

    const output = request.stdout || "";
    const markerIndex = output.lastIndexOf(marker);

    if (markerIndex >= 0) {
      rawText = output.slice(0, markerIndex).trim();
      const statusText = output.slice(markerIndex + marker.length).trim();
      status = Number(statusText) || 0;
    } else {
      rawText = output.trim();
    }

    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = null;
    }
  } catch (error) {
    networkError = error instanceof Error ? error.message : String(error);
  }

  const elapsedSeconds = Number(((Date.now() - startedAt) / 1000).toFixed(3));
  const parsedExperiences = Array.isArray(payload?.experiences) ? payload.experiences : [];
  const experiences = Array.isArray(payload?.experiences) ? parsedExperiences.length : null;
  const uniquePositions = new Set(
    parsedExperiences
      .map((item) =>
        item && typeof item === "object" && typeof item.position === "string"
          ? item.position.trim().toLowerCase()
          : "",
      )
      .filter(Boolean),
  ).size;

  const qualityErrors = [];
  const minimumExperiences = MIN_EXPERIENCES_BY_FIXTURE.get(name);
  const minimumUniquePositions = MIN_UNIQUE_POSITIONS_BY_FIXTURE.get(name);

  if (
    Number.isFinite(minimumExperiences) &&
    experiences != null &&
    experiences < minimumExperiences
  ) {
    qualityErrors.push(
      `Expected at least ${minimumExperiences} experiences for ${name}, got ${experiences}.`,
    );
  }

  if (
    Number.isFinite(minimumUniquePositions) &&
    uniquePositions < minimumUniquePositions
  ) {
    qualityErrors.push(
      `Expected at least ${minimumUniquePositions} unique role titles for ${name}, got ${uniquePositions}.`,
    );
  }

  const passed =
    status === 200 && Array.isArray(payload?.experiences) && qualityErrors.length === 0;

  const error =
    payload?.error ||
    networkError ||
    qualityErrors[0] ||
    (!passed ? rawText.slice(0, 300) : "");

  return {
    elapsedSeconds,
    error,
    experiences,
    file: filePath,
    model: payload?.model || null,
    passed,
    status: status || "ERR",
    uniquePositions,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new Error("`--timeout-ms` must be a positive number.");
  }

  if (!commandExists("curl")) {
    throw new Error("`curl` is required to run the parser regression script.");
  }

  const outDir =
    options.outDir ||
    path.join(os.tmpdir(), `cv-parser-regression-${Date.now()}`);
  const fixturesDir = path.join(outDir, "fixtures");
  const warnings = [];

  await fs.mkdir(fixturesDir, { recursive: true });

  const txtFixtures = await writeTextFixtures(fixturesDir);
  const docxFixtures = await createDocxFixtures(fixturesDir, txtFixtures, warnings);
  const pdfFixtures = await createPdfFixtures(fixturesDir, txtFixtures, warnings);

  const fixtureFiles = [...txtFixtures, ...docxFixtures, ...pdfFixtures];
  const userFiles = [];

  for (const candidate of options.userFiles) {
    const resolved = path.resolve(candidate);
    if (await ensureFileExists(resolved, warnings)) {
      userFiles.push(resolved);
    }
  }

  const allFiles = [...fixtureFiles, ...userFiles];

  if (allFiles.length === 0) {
    throw new Error("No fixtures were created. Check local conversion tools.");
  }

  const results = [];
  for (const filePath of allFiles) {
    results.push(
      await runParserCase({
        baseUrl: options.baseUrl,
        filePath,
        timeoutMs: options.timeoutMs,
      }),
    );
  }

  const resultsPath = path.join(outDir, "results.json");
  await fs.writeFile(resultsPath, `${JSON.stringify(results, null, 2)}\n`, "utf8");

  const csvPath = path.join(outDir, "results.csv");
  const csvRows = [
    toCsvRow([
      "file",
      "status",
      "seconds",
      "experiences",
      "unique_positions",
      "model",
      "passed",
      "error",
    ]),
    ...results.map((result) =>
      toCsvRow([
        result.file,
        result.status,
        result.elapsedSeconds,
        result.experiences ?? "",
        result.uniquePositions ?? "",
        result.model ?? "",
        result.passed,
        result.error ?? "",
      ]),
    ),
  ];
  await fs.writeFile(csvPath, `${csvRows.join("\n")}\n`, "utf8");

  const passed = results.filter((result) => result.passed);
  const failed = results.filter((result) => !result.passed);
  const passedDurations = passed.map((result) => result.elapsedSeconds);
  const averageSeconds =
    passedDurations.length > 0
      ? Number(
          (
            passedDurations.reduce((sum, value) => sum + value, 0) /
            passedDurations.length
          ).toFixed(2),
        )
      : 0;

  console.log(`CV parser regression complete (${options.baseUrl})`);
  console.log(`Output: ${outDir}`);
  console.log(`Cases: ${results.length} | Passed: ${passed.length} | Failed: ${failed.length}`);
  if (passedDurations.length > 0) {
    console.log(
      `Latency (passed): avg ${averageSeconds}s | min ${Math.min(...passedDurations).toFixed(2)}s | max ${Math.max(...passedDurations).toFixed(2)}s`,
    );
  }

  if (warnings.length > 0) {
    console.log("\nWarnings:");
    for (const warning of warnings) {
      console.log(`- ${warning}`);
    }
  }

  console.log("\nPer-case:");
  for (const result of results) {
    const label = result.passed ? "PASS" : "FAIL";
    console.log(
      `[${label}] ${path.basename(result.file)} | status=${result.status} | ${result.elapsedSeconds}s | experiences=${result.experiences ?? "-"} | uniquePositions=${result.uniquePositions ?? "-"}${result.model ? ` | model=${result.model}` : ""}`,
    );
    if (!result.passed && result.error) {
      console.log(`       error: ${result.error}`);
    }
  }

  console.log(`\nJSON: ${pathToFileURL(resultsPath).href}`);
  console.log(`CSV:  ${pathToFileURL(csvPath).href}`);

  if (options.strict && failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`CV parser regression failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
