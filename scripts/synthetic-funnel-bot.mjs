/**
 * Synthetic end-to-end funnel bot.
 *
 * Drives a real browser through the full application journey so the PostHog
 * funnel (DIS-196) and submit-blocker (DIS-197) tiles populate with *labelled*
 * test data. Every event captured during this run carries `synthetic_test: true`
 * (see src/lib/analytics/posthogClient.ts), so it can be excluded from real
 * metrics (the project's internal/test-account filter already lists it).
 *
 * HOW IT WORKS
 *   1. The app drops automation traffic (navigator.webdriver / headless /
 *      Playwright). Loading the app once with `?kp_synthetic=<token>` opens the
 *      authorised doorway and persists it to localStorage for the session.
 *   2. The token must match `VITE_ANALYTICS_SYNTHETIC_TOKEN` baked into the
 *      deployment. Set it on a PREVIEW/QA deploy — never production.
 *   3. The journey is auth-gated, so TEST_EMAIL/TEST_PASSWORD are required.
 *   4. The script tallies ingestion POSTs to `/ingest/*` as proof of capture and
 *      logs every step so any selector mismatch is obvious.
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
 * The app's selects are a custom `NativeSelect` (a button[role=combobox] over a
 * hidden <select>), so we open the combobox and click a role=option rather than
 * calling selectOption(). Submissions write Supabase rows and can trigger the
 * eligibility AI / emails — run against preview and clean up after.
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

/** Locate a NativeSelect's combobox button by accessible name, else by label text. */
async function findCombobox(page, labelRe) {
  const byName = page.getByRole("combobox", { name: labelRe }).first();
  if (await byName.count()) return byName;
  const label = page.locator("label").filter({ hasText: labelRe }).first();
  if (await label.count()) {
    // first combobox appearing after the label in document order
    const near = label.locator('xpath=following::*[@role="combobox"][1]');
    if (await near.count()) return near;
  }
  return null;
}

/**
 * Drive a NativeSelect: open it and click an option.
 * opts.option — exact/regex option text to pick; opts.pick — "first" | "last"
 * real (non-placeholder) option when no explicit option is given.
 */
async function selectField(page, labelRe, opts = {}) {
  const { option = null, pick = "first", exact = false } = opts;
  const combo = await findCombobox(page, labelRe);
  if (!combo) {
    warn(`select not found: ${labelRe}`);
    return false;
  }
  await combo.scrollIntoViewIfNeeded().catch(() => {});
  await combo.click().catch(() => {});
  const listbox = page.getByRole("listbox").first();
  await listbox.waitFor({ state: "visible", timeout: 4000 }).catch(() => {});

  let target;
  if (option != null) {
    target = listbox.getByRole("option", { name: option, exact }).first();
  } else {
    const real = listbox.locator('[role="option"][data-value]:not([data-value=""])');
    target = pick === "last" ? real.last() : real.first();
  }
  if (!(await target.count())) {
    warn(`no matching option for: ${labelRe}`);
    await page.keyboard.press("Escape").catch(() => {});
    return false;
  }
  await target.click().catch(() => {});
  return true;
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

/**
 * Eligibility check → "Start application" (fires application_start_requested).
 * The modal has "Select: Education level" / "Select: Experience" NativeSelects
 * and a "Next" button. Pick the highest (last) option to maximise eligibility.
 */
async function startApplication(page) {
  if (!(await clickButton(page, /eligibility check/i, { required: true }))) return false;
  await page.waitForTimeout(600);
  await selectField(page, /Education level/i, { pick: "last" });
  await selectField(page, /Experience/i, { pick: "last" }); // conditional; warns if absent
  await clickButton(page, /^Next$/i, { required: true });

  const start = page
    .getByRole("button", {
      name: /start application|continue application|choose how to start|start brand new application/i,
    })
    .first();
  await start.waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
  if (!(await start.count())) {
    warn("No 'Start application' button appeared — may not be eligible for this course.");
    return false;
  }
  await start.click().catch(() => {});
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(500);
  return true;
}

/** A fresh draft lands on /overview; click its CTA through to Section 1. */
async function enterSections(page) {
  if (!page.url().includes("/overview")) return;
  await clickButton(page, /start|continue|resume|begin/i);
  await page.waitForLoadState("networkidle").catch(() => {});
  if (page.url().includes("/overview")) {
    await page.goto(`${BASE_URL}/section1/basic-info`, { waitUntil: "networkidle" }).catch(() => {});
  }
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
  await selectField(page, /^Status/, { option: /Australian Citizen/i });
  await continueStep(page);
  // address
  await fillField(page, /residential address/i, "123 Test Street, Melbourne VIC 3000");
  await page.waitForTimeout(600);
  await page.keyboard.press("Escape").catch(() => {}); // dismiss any autocomplete dropdown
  await continueStep(page);
  // cultural-background
  await selectField(page, /^Language/);
  await selectField(page, /^Status/); // Aboriginal/TSI status
  await selectField(page, /School level/i);
  await continueStep(page);
  // family-support
  await selectField(page, /parents|guardians/i, { option: "0", exact: true });
  await page.getByRole("radio", { name: /^no$/i }).first().check().catch(() => {});
  await continueStep(page);
}

/** Section 2: add one tertiary qualification (enough to satisfy submit validation). */
async function addTertiary(page) {
  await clickButton(page, /add.*tertiary/i, { required: true });
  await page.waitForLoadState("networkidle").catch(() => {});
  await fillField(page, /^Institution/, "Test University");
  await selectField(page, /^Country/, { option: /Australia/i });
  await selectField(page, /Qualification level/i);
  await fillField(page, /Course name|Program name/i, "Bachelor of Testing");
  await selectField(page, /Start month/i);
  await selectField(page, /Start year/i);
  await selectField(page, /End month/i);
  await selectField(page, /End year/i, { pick: "last" });
  await clickButton(page, /^Save & Continue$/i, { required: true });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(400);
  await continueStep(page); // qualifications overview → /review
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
  await enterSections(page);
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
