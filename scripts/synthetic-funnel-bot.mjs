/**
 * Synthetic end-to-end funnel bot.
 *
 * Drives a real browser through the full application journey so the PostHog
 * funnel (DIS-196) and submit-blocker (DIS-197) tiles populate with *labelled*
 * test data. Every event captured during this run carries `synthetic_test: true`
 * (see src/lib/analytics/posthogClient.ts), so it can be excluded from real
 * metrics.
 *
 * HOW IT WORKS
 *   1. The app drops automation traffic (navigator.webdriver / headless /
 *      Playwright). Loading the app once with `?kp_synthetic=<token>` opens the
 *      authorised doorway and persists it to localStorage for the session.
 *   2. The token must match `VITE_ANALYTICS_SYNTHETIC_TOKEN` baked into the
 *      deployment. Set it on a PREVIEW/QA deploy — never production.
 *   3. The journey is auth-gated, so TEST_EMAIL/TEST_PASSWORD are required for
 *      the happy/blocked paths (a throwaway account on the target environment).
 *   4. The script tallies ingestion POSTs to `/ingest/*` as live proof of capture
 *      and logs every step so any selector mismatch is obvious.
 *
 * USAGE
 *   BASE_URL=https://<preview>.vercel.app \
 *   SYNTHETIC_TOKEN=<= VITE_ANALYTICS_SYNTHETIC_TOKEN> \
 *   TEST_EMAIL=<acct> TEST_PASSWORD=<pw> \
 *   node scripts/synthetic-funnel-bot.mjs
 *
 *   MODE=happy|blocked|both (default both) · ITERATIONS=1 · HEADFUL=1 to watch ·
 *   COURSE_PATH=/courses/<slug> (fallback if the catalog button selector misses).
 *   (If chromium isn't installed: `npx playwright install chromium`.)
 *
 * SELECTORS were mapped from the components (no data-testid in the app, so we use
 * getByLabel / getByRole). Real submissions write Supabase rows and can trigger
 * the eligibility AI / emails — run against preview and clean up after.
 */
import { chromium } from "playwright";

const BASE_URL = (process.env.BASE_URL ?? "").replace(/\/+$/, "");
const SYNTHETIC_TOKEN = process.env.SYNTHETIC_TOKEN ?? "";
const TEST_EMAIL = process.env.TEST_EMAIL ?? "";
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "";
const MODE = (process.env.MODE ?? "both").toLowerCase(); // happy | blocked | both
const ITERATIONS = Number(process.env.ITERATIONS ?? "1");
const HEADFUL = process.env.HEADFUL === "1";

if (!BASE_URL || !SYNTHETIC_TOKEN) {
  console.error(
    "Set BASE_URL and SYNTHETIC_TOKEN (matching VITE_ANALYTICS_SYNTHETIC_TOKEN on the target deploy).",
  );
  process.exit(1);
}

const log = (msg) => console.log(`  ${msg}`);
const warn = (msg) => console.warn(`  ⚠️  ${msg}`);

/** Count ingestion POSTs so we can prove capture is happening (not assets/config). */
function attachIngestCounter(page) {
  const counter = { count: 0 };
  page.on("request", (req) => {
    const url = req.url();
    if (
      req.method() === "POST" &&
      url.includes("/ingest/") &&
      !url.includes("/ingest/static/") &&
      !url.includes("/ingest/array/")
    ) {
      counter.count += 1;
    }
  });
  return counter;
}

async function fillField(page, labelRe, value) {
  const f = page.getByLabel(labelRe).first();
  if (await f.count()) {
    await f.fill(String(value)).catch(() => {});
    return true;
  }
  warn(`field not found: ${labelRe}`);
  return false;
}

/** Pick the first real <option> (index 1 skips the placeholder) unless a label is given. */
async function selectField(page, labelRe, option = { index: 1 }) {
  const f = page.getByLabel(labelRe).first();
  if (!(await f.count())) {
    warn(`select not found: ${labelRe}`);
    return false;
  }
  try {
    await f.selectOption(option);
    return true;
  } catch {
    try {
      await f.selectOption({ index: 1 });
      return true;
    } catch {
      warn(`could not select an option for: ${labelRe}`);
      return false;
    }
  }
}

async function clickButton(page, nameRe, { required = false } = {}) {
  const b = page.getByRole("button", { name: nameRe }).first();
  if (await b.count()) {
    await b.click().catch(() => {});
    return true;
  }
  (required ? warn : log)(`button not found: ${nameRe}`);
  return false;
}

async function continueStep(page) {
  const before = page.url();
  await clickButton(page, /^(Continue|Save & Continue|Next)$/i, { required: true });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(400);
  if (page.url() === before) {
    warn(`did not advance from ${new URL(before).pathname} (validation may have blocked it)`);
  }
}

async function activateSynthetic(page) {
  await page.goto(`${BASE_URL}/?kp_synthetic=${encodeURIComponent(SYNTHETIC_TOKEN)}`, {
    waitUntil: "networkidle",
  });
  const active = await page.evaluate(() =>
    window.localStorage.getItem("keypath.analytics.synthetic_test"),
  );
  if (active) log("✓ Synthetic-test mode active.");
  else warn("Synthetic flag not stored — token likely ≠ the deploy's VITE_ANALYTICS_SYNTHETIC_TOKEN. Events will be dropped.");
  return Boolean(active);
}

async function signIn(page) {
  if (!TEST_EMAIL || !TEST_PASSWORD) {
    warn("No TEST_EMAIL/TEST_PASSWORD — the journey is auth-gated, so happy/blocked paths will be skipped.");
    return false;
  }
  await page.goto(`${BASE_URL}/sign-in`, { waitUntil: "networkidle" });
  await fillField(page, /^Email/i, TEST_EMAIL);
  await fillField(page, /^Password/i, TEST_PASSWORD);
  await clickButton(page, /sign in|log in/i, { required: true });
  await page.waitForLoadState("networkidle").catch(() => {});
  const authed = !page.url().includes("/sign-in");
  if (authed) log("✓ Signed in.");
  else warn("Sign-in did not complete (still on /sign-in).");
  return authed;
}

/** Catalog → course details. */
async function openCourse(page) {
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  const viewCourse = page.getByRole("button", { name: /view course/i }).first();
  if (await viewCourse.count()) {
    await viewCourse.click().catch(() => {});
    await page.waitForLoadState("networkidle").catch(() => {});
  } else if (process.env.COURSE_PATH) {
    await page.goto(`${BASE_URL}${process.env.COURSE_PATH}`, { waitUntil: "networkidle" });
  } else {
    warn("No 'View course' button and no COURSE_PATH — staying on catalog.");
  }
}

/** Eligibility check → "Start application" (fires application_start_requested). */
async function startApplication(page) {
  await clickButton(page, /eligibility check/i);
  await page.waitForTimeout(800);
  // Best-effort: answer the eligibility questions affirmatively.
  const yes = page.getByRole("radio", { name: /^yes$/i });
  for (let i = 0; i < (await yes.count()); i += 1) {
    await yes.nth(i).check().catch(() => {});
  }
  await clickButton(page, /check (my )?eligibility|see results|continue/i);
  await page.waitForTimeout(1500);
  const started = await clickButton(
    page,
    /start application|continue application|choose how to start|start brand new application/i,
    { required: true },
  );
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(500);
  return started;
}

/** Fill the six Section 1 steps with valid minimal values. */
async function fillSection1(page) {
  // basic-info
  await selectField(page, /^Title/);
  await fillField(page, /^First name/, "Synth");
  await fillField(page, /^Last name/, "Test");
  await continueStep(page);
  // personal-contact
  await selectField(page, /^Gender/);
  await fillField(page, /Date of birth/i, "1990-01-15");
  await fillField(page, /^Email/i, TEST_EMAIL || "synthetic@example.com");
  await fillField(page, /^Phone/i, "0400000000");
  await continueStep(page);
  // contact-info (citizenship)
  await selectField(page, /^Status/, { label: "Australian Citizen" });
  await continueStep(page);
  // address
  await fillField(page, /residential address/i, "123 Test Street, Melbourne VIC 3000");
  await page.waitForTimeout(600);
  await page.keyboard.press("Escape").catch(() => {}); // dismiss any autocomplete dropdown
  await continueStep(page);
  // cultural-background
  await selectField(page, /^Language/);
  await selectField(page, /^Status/); // Aboriginal/TSI status
  await selectField(page, /^School level/);
  await continueStep(page);
  // family-support
  await selectField(page, /parents|guardians/i, { label: "0" });
  // any conditional parent-education selects that appeared:
  const parentSelects = page.getByLabel(/Parent .* completed/i);
  for (let i = 0; i < (await parentSelects.count()); i += 1) {
    await parentSelects.nth(i).selectOption({ index: 1 }).catch(() => {});
  }
  await page.getByRole("radio", { name: /^no$/i }).first().check().catch(() => {});
  await continueStep(page);
}

/** Section 2: add one tertiary qualification (enough to satisfy submit validation). */
async function addTertiary(page) {
  await clickButton(page, /add.*tertiary/i, { required: true });
  await page.waitForLoadState("networkidle").catch(() => {});
  await fillField(page, /^Institution/, "Test University");
  await selectField(page, /^Country/, { label: "Australia" });
  await selectField(page, /Qualification level/i);
  await fillField(page, /Course name|Program name/i, "Bachelor of Testing");
  await selectField(page, /Start month/i);
  await selectField(page, /Start year/i);
  await selectField(page, /End month/i);
  await selectField(page, /End year/i);
  await clickButton(page, /^Save & Continue$/i, { required: true });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(400);
  // back on the qualifications overview → continue to /review
  await continueStep(page);
}

/** Submit and verify we reach /submitted. */
async function submitHappy(page) {
  if (!page.url().includes("/review")) {
    await page.goto(`${BASE_URL}/review`, { waitUntil: "networkidle" }).catch(() => {});
  }
  await clickButton(page, /^Submit application$/i, { required: true });
  await page.waitForTimeout(3000);
  if (page.url().includes("/submitted")) {
    log("✅ Reached /submitted — application_submitted should have fired.");
    return true;
  }
  warn("Did not reach /submitted — likely a validation block; check the field warnings above.");
  return false;
}

async function runHappy(page) {
  console.log("\n=== happy path ===");
  await openCourse(page);
  if (!(await startApplication(page))) return;
  await fillSection1(page);
  await addTertiary(page);
  await submitHappy(page);
}

/** Blocked path (DIS-197): start a draft, jump to /review with fields empty, submit. */
async function runBlocked(page) {
  console.log("\n=== blocked path ===");
  await openCourse(page);
  if (!(await startApplication(page))) return;
  await page.goto(`${BASE_URL}/review`, { waitUntil: "networkidle" }).catch(() => {});
  if (page.url().includes("/sign-in")) {
    warn("/review redirected to sign-in — not authenticated.");
    return;
  }
  await clickButton(page, /^Submit application$/i, { required: true });
  await page.waitForTimeout(1500);
  if (page.url().includes("/submitted")) {
    warn("Reached /submitted — the draft was already complete, so no block fired.");
  } else {
    log("✅ Stayed on /review — application_submit_blocked should have fired.");
  }
}

async function run() {
  const browser = await chromium.launch({ headless: !HEADFUL });
  const page = await browser.newContext().then((c) => c.newPage());
  const ingest = attachIngestCounter(page);

  await activateSynthetic(page);
  const authed = await signIn(page);

  for (let i = 0; i < ITERATIONS; i += 1) {
    console.log(`\n— iteration ${i + 1}/${ITERATIONS} —`);
    if (!authed) {
      warn("Skipping auth-gated paths (no sign-in). Only catalog events fired.");
      break;
    }
    if (MODE === "happy" || MODE === "both") await runHappy(page);
    if (MODE === "blocked" || MODE === "both") await runBlocked(page);
  }

  await page.waitForTimeout(2500); // flush the final batch
  console.log(`\n✓ Done. Ingestion POSTs observed: ${ingest.count}`);
  console.log("View the funnel with the test-account filter OFF to see synthetic_test data.");
  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
