#!/usr/bin/env tsx
/**
 * Generates a human-readable HTML review pack for course eligibility requirements.
 * Open in a browser to compare what the site shows vs how we interpreted it.
 *
 *   npm run eligibility:review
 *   npm run eligibility:review -- --code=master-of-health-management
 *   npm run eligibility:review -- --open
 */

import { execSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getCourseCatalog } from "../src/lib/courseCatalog/buildCatalog.js";
import {
  getGeneratedRequirementsForCourse,
  getRawGeneratedRequirementsEntry,
} from "../src/lib/courseCatalog/requirementsLoader.js";
import { buildCourseRequirementsPlainReview } from "../src/lib/eligibility/courseRequirementsReviewText.js";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = resolve(__filename, "../..");
const OUTPUT_DIR = resolve(repoRoot, "reports/course-requirements-review");

interface Flags {
  code?: string;
  open: boolean;
  baseUrl: string;
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { open: false, baseUrl: "http://localhost:5173" };
  for (const arg of argv.slice(2)) {
    if (arg === "--open") flags.open = true;
    else if (arg.startsWith("--code=")) flags.code = arg.slice("--code=".length);
    else if (arg.startsWith("--base-url=")) flags.baseUrl = arg.slice("--base-url=".length);
  }
  return flags;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderRequirementList(requirements: ReturnType<typeof buildCourseRequirementsPlainReview>["globalRequirements"]) {
  if (requirements.length === 0) {
    return "<p class=\"muted\">None</p>";
  }
  return `<ul class="req-list">${requirements
    .map(
      (requirement) => `
        <li>
          <strong>${escapeHtml(requirement.summary)}</strong>
          ${requirement.orGroup ? `<span class="pill">OR group: ${escapeHtml(requirement.orGroup)}</span>` : ""}
          <div class="quote">${escapeHtml(requirement.sourceText)}</div>
        </li>`,
    )
    .join("")}</ul>`;
}

function renderCourseCard(
  review: ReturnType<typeof buildCourseRequirementsPlainReview>,
  baseUrl: string,
) {
  const courseUrl = `${baseUrl.replace(/\/$/, "")}/courses/${encodeURIComponent(review.courseCode)}`;
  const engineClass = review.engine.includes("legacy") ? "badge-warn" : "badge-ok";

  return `
    <article class="course-card" id="${escapeHtml(review.courseCode)}">
      <header>
        <h2>${escapeHtml(review.title)}</h2>
        <p class="meta">${escapeHtml(review.provider)} · <code>${escapeHtml(review.courseCode)}</code></p>
        <div class="badges">
          <span class="badge ${engineClass}">${escapeHtml(review.engine)}</span>
          <a class="badge badge-link" href="${escapeHtml(courseUrl)}" target="_blank" rel="noreferrer">Open course page ↗</a>
        </div>
      </header>

      <section>
        <h3>What the website shows</h3>
        <p class="quote block">${escapeHtml(review.entryRequirementsText)}</p>
      </section>

      <section>
        <h3>How we interpreted it</h3>
        <p class="logic">${escapeHtml(review.pathwayLogic)}</p>
        ${review.globalRequirements.length > 0 ? `<h4>Applies to every pathway</h4>${renderRequirementList(review.globalRequirements)}` : ""}
        ${review.pathways
          .map(
            (pathway) => `
          <h4>${escapeHtml(pathway.label)}</h4>
          ${renderRequirementList(pathway.requirements)}
        `,
          )
          .join("")}
        <h4>Applicant-facing summary</h4>
        <ul>${review.checklistForApplicant.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </section>

      <section>
        <h3>Pre-apply eligibility questions</h3>
        ${
          review.eligibilityQuestions.length === 0
            ? "<p class=\"muted\">Uses legacy education/experience dropdowns only.</p>"
            : review.eligibilityQuestions
                .map(
                  (question) => `
            <div class="question">
              <strong>${escapeHtml(question.label)}</strong>
              <ul>${question.options.map((option) => `<li>${escapeHtml(option)}</li>`).join("")}</ul>
            </div>`,
                )
                .join("")
        }
      </section>

      <section class="corrections">
        <h3>Your corrections (for tuning)</h3>
        <p class="muted">Note what is wrong, missing, or grouped incorrectly. Copy this into chat, Notion, or a PR comment.</p>
        <textarea
          data-course="${escapeHtml(review.courseCode)}"
          placeholder="Example: Pathway 2 should not require work experience. English should be global only. Missing GPA 4/7 on pathway 1."
          rows="4"
        ></textarea>
      </section>
    </article>
  `;
}

function renderPage(reviews: ReturnType<typeof buildCourseRequirementsPlainReview>[], baseUrl: string) {
  const generatedAt = new Date().toLocaleString();
  const toc = reviews
    .map(
      (review) => `
      <a href="#${escapeHtml(review.courseCode)}" class="toc-item">
        <span>${escapeHtml(review.title)}</span>
        <span class="toc-meta ${review.engine.includes("legacy") ? "warn" : "ok"}">${review.engine.includes("legacy") ? "Legacy" : "Matcher"}</span>
      </a>`,
    )
    .join("");

  const cards = reviews.map((review) => renderCourseCard(review, baseUrl)).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Course eligibility requirements review</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f4ef;
      --card: #fff;
      --text: #1c1917;
      --muted: #57534e;
      --border: #e7e5e4;
      --accent: #0f766e;
      --warn: #b45309;
      --ok: #15803d;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
    }
    .layout {
      display: grid;
      grid-template-columns: 280px 1fr;
      min-height: 100vh;
    }
    nav {
      position: sticky;
      top: 0;
      height: 100vh;
      overflow: auto;
      padding: 1.25rem;
      border-right: 1px solid var(--border);
      background: #fff;
    }
    nav h1 { font-size: 1rem; margin: 0 0 0.5rem; }
    nav p { color: var(--muted); font-size: 0.85rem; margin: 0 0 1rem; }
    .toc-item {
      display: flex;
      justify-content: space-between;
      gap: 0.5rem;
      padding: 0.5rem 0;
      border-bottom: 1px solid var(--border);
      color: inherit;
      text-decoration: none;
      font-size: 0.9rem;
    }
    .toc-meta { font-size: 0.75rem; white-space: nowrap; }
    .toc-meta.ok { color: var(--ok); }
    .toc-meta.warn { color: var(--warn); }
    main { padding: 1.5rem 2rem 4rem; max-width: 960px; }
    .course-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem 1.5rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 1px 2px rgba(0,0,0,0.04);
    }
    h2 { margin: 0 0 0.25rem; font-size: 1.35rem; }
    h3 { margin: 1.25rem 0 0.5rem; font-size: 1rem; color: var(--accent); }
    h4 { margin: 1rem 0 0.35rem; font-size: 0.95rem; }
    .meta { color: var(--muted); margin: 0; }
    .badges { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.75rem; }
    .badge {
      display: inline-block;
      padding: 0.2rem 0.55rem;
      border-radius: 999px;
      font-size: 0.75rem;
      background: #f5f5f4;
      border: 1px solid var(--border);
    }
    .badge-ok { background: #ecfdf5; color: var(--ok); border-color: #bbf7d0; }
    .badge-warn { background: #fffbeb; color: var(--warn); border-color: #fde68a; }
    .badge-link { text-decoration: none; color: var(--accent); }
    .quote { color: var(--muted); font-size: 0.92rem; }
    .quote.block {
      background: #fafaf9;
      border-left: 3px solid var(--border);
      padding: 0.75rem 1rem;
      white-space: pre-wrap;
    }
    .logic { font-weight: 600; }
    .req-list { margin: 0; padding-left: 1.1rem; }
    .req-list li { margin-bottom: 0.75rem; }
    .pill {
      display: inline-block;
      margin-left: 0.35rem;
      font-size: 0.72rem;
      padding: 0.1rem 0.4rem;
      border-radius: 4px;
      background: #eff6ff;
      color: #1d4ed8;
    }
    .question { margin-bottom: 0.75rem; }
    .muted { color: var(--muted); font-size: 0.9rem; }
    textarea {
      width: 100%;
      font: inherit;
      padding: 0.75rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      resize: vertical;
    }
    .toolbar {
      position: fixed;
      bottom: 1rem;
      right: 1rem;
      display: flex;
      gap: 0.5rem;
    }
    button {
      font: inherit;
      padding: 0.55rem 0.9rem;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: #fff;
      cursor: pointer;
    }
    button.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
    @media (max-width: 900px) {
      .layout { grid-template-columns: 1fr; }
      nav { position: static; height: auto; max-height: 40vh; }
    }
  </style>
</head>
<body>
  <div class="layout">
    <nav>
      <h1>Eligibility review</h1>
      <p>Generated ${escapeHtml(generatedAt)}<br/>${reviews.length} courses</p>
      ${toc}
    </nav>
    <main>${cards}</main>
  </div>
  <div class="toolbar">
    <button type="button" id="copy-corrections">Copy all corrections</button>
    <button type="button" class="primary" id="save-local">Save notes in browser</button>
  </div>
  <script>
    const storageKey = "course-requirements-review-notes-v1";
    const areas = document.querySelectorAll("textarea[data-course]");
    const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
    areas.forEach((area) => {
      const code = area.getAttribute("data-course");
      if (code && saved[code]) area.value = saved[code];
      area.addEventListener("input", () => {
        saved[code] = area.value;
        localStorage.setItem(storageKey, JSON.stringify(saved));
      });
    });
    document.getElementById("save-local")?.addEventListener("click", () => {
      localStorage.setItem(storageKey, JSON.stringify(saved));
      alert("Notes saved in this browser.");
    });
    document.getElementById("copy-corrections")?.addEventListener("click", () => {
      const lines = [];
      areas.forEach((area) => {
        const text = area.value.trim();
        if (!text) return;
        lines.push("## " + area.getAttribute("data-course") + "\\n" + text);
      });
      if (lines.length === 0) {
        alert("No corrections entered yet.");
        return;
      }
      navigator.clipboard.writeText(lines.join("\\n\\n"));
      alert("Copied " + lines.length + " correction note(s) to clipboard.");
    });
  </script>
</body>
</html>`;
}

async function main() {
  const flags = parseFlags(process.argv);
  const catalog = getCourseCatalog();
  const targets = flags.code
    ? catalog.filter((course) => course.code === flags.code)
    : catalog;

  if (targets.length === 0) {
    throw new Error(flags.code ? `Unknown course code: ${flags.code}` : "Catalog is empty.");
  }

  const reviews = targets.map((course) =>
    buildCourseRequirementsPlainReview(course, {
      usesMatcher: Boolean(getGeneratedRequirementsForCourse(course.code)),
      rawRequirements: getRawGeneratedRequirementsEntry(course.code),
    }),
  );

  await mkdir(OUTPUT_DIR, { recursive: true });
  const htmlPath = resolve(OUTPUT_DIR, "index.html");
  await writeFile(htmlPath, renderPage(reviews, flags.baseUrl), "utf8");

  console.log(`Wrote ${htmlPath}`);
  console.log(`Courses: ${reviews.length}`);
  console.log(`Open: file://${htmlPath}`);
  console.log(`With dev server running, use course links at ${flags.baseUrl}/courses/<code>`);

  if (flags.open) {
    execSync(`open "${htmlPath}"`, { stdio: "inherit" });
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
