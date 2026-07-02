#!/usr/bin/env node
/**
 * Fails the build if any of the app's core public pages throw a console
 * error, an unhandled promise rejection, or a same-origin HTTP 4xx/5xx while
 * loading. Run against a built app (`vite preview`), not the dev server, so
 * this matches what a real user's browser would see.
 *
 * USAGE
 *   npm run build
 *   npx vite preview --port 4173 --strictPort &
 *   node scripts/console-smoke.mjs --base-url http://127.0.0.1:4173
 */
import { chromium } from "playwright";

const args = process.argv.slice(2);

function argValue(flag, fallback) {
  const index = args.indexOf(flag);
  return index === -1 ? fallback : args[index + 1];
}

const BASE_URL = (
  argValue("--base-url", process.env.SMOKE_BASE_URL) ?? "http://127.0.0.1:4173"
).replace(/\/+$/, "");

// Public, unauthenticated routes only — the applicant journey behind
// AuthRequiredLayout needs a signed-in session (see scripts/smoke-eligibility-ui.mjs
// for that, run separately against a real account).
const ROUTES = ["/", "/sign-in"];

async function collectIssues(page, path) {
  const issues = [];

  const onConsole = (message) => {
    if (message.type() === "error") {
      issues.push(`[console.error] ${message.text()}`);
    }
  };
  const onPageError = (error) => {
    issues.push(`[pageerror] ${error.message}`);
  };
  const onResponse = (response) => {
    const url = new URL(response.url());
    const isSameOrigin = url.origin === new URL(BASE_URL).origin;
    if (isSameOrigin && response.status() >= 400) {
      issues.push(`[http ${response.status()}] ${response.url()}`);
    }
  };

  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("response", onResponse);

  await page.goto(`${BASE_URL}${path}`, { waitUntil: "load", timeout: 30000 });
  // Give async effects (data hydration, analytics init) a beat to fire and
  // surface any unhandled rejection before we move on.
  await page.waitForTimeout(2000);

  page.off("console", onConsole);
  page.off("pageerror", onPageError);
  page.off("response", onResponse);

  return issues;
}

async function collectCourseDetailsIssues(page) {
  const issues = [];
  const onConsole = (message) => {
    if (message.type() === "error") issues.push(`[console.error] ${message.text()}`);
  };
  const onPageError = (error) => issues.push(`[pageerror] ${error.message}`);
  page.on("console", onConsole);
  page.on("pageerror", onPageError);

  const viewCourseButton = page.getByRole("button", { name: "View course" }).first();
  const hasCourses = await viewCourseButton.isVisible({ timeout: 15000 }).catch(() => false);

  if (!hasCourses) {
    page.off("console", onConsole);
    page.off("pageerror", onPageError);
    return { issues, ran: false };
  }

  await viewCourseButton.click();
  await page.waitForURL("**/courses/**", { timeout: 15000 });
  await page.waitForTimeout(2000);

  page.off("console", onConsole);
  page.off("pageerror", onPageError);
  return { issues, ran: true };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const report = [];

try {
  for (const path of ROUTES) {
    const issues = await collectIssues(page, path);
    report.push({ path, issues });
    console.log(`${path} -> ${issues.length === 0 ? "OK" : `${issues.length} issue(s)`}`);
  }

  // Course details is reached via a click-through from the catalog rather
  // than a hardcoded slug, so this doesn't go stale as the catalog changes.
  await page.goto(`${BASE_URL}/`, { waitUntil: "load", timeout: 30000 });
  const { issues: courseIssues, ran } = await collectCourseDetailsIssues(page);
  if (ran) {
    report.push({ path: "/courses/:code (via catalog click-through)", issues: courseIssues });
    console.log(
      `/courses/:code -> ${courseIssues.length === 0 ? "OK" : `${courseIssues.length} issue(s)`}`,
    );
  } else {
    console.log("/courses/:code -> skipped (no course cards rendered)");
  }
} finally {
  await browser.close();
}

const failing = report.filter((entry) => entry.issues.length > 0);

if (failing.length > 0) {
  console.error("\nConsole smoke check failed:\n");
  for (const entry of failing) {
    console.error(`${entry.path}:`);
    entry.issues.forEach((issue) => console.error(`  ${issue}`));
  }
  process.exit(1);
}

console.log("\nConsole smoke check passed — no console errors on public routes.");
