/**
 * Synthetic end-to-end funnel bot.
 *
 * Drives a real browser through the application journey so the PostHog funnel
 * (DIS-196) and submit-blocker (DIS-197) tiles populate with *labelled* test
 * data. Every event captured during this run carries `synthetic_test: true`
 * (see src/lib/analytics/posthogClient.ts), so it can be excluded from real
 * metrics.
 *
 * HOW IT WORKS
 *   1. The app normally drops automation traffic (navigator.webdriver / headless
 *      / Playwright). Loading the app once with `?kp_synthetic=<token>` opens the
 *      authorised doorway and persists it to localStorage for the session.
 *   2. The token must match `VITE_ANALYTICS_SYNTHETIC_TOKEN` baked into the
 *      deployment you point this at. Set it on a PREVIEW/QA deployment — never
 *      rely on it being set in normal production.
 *   3. This script also tallies ingestion POSTs to `/ingest/*` as live proof
 *      that capture is actually happening.
 *
 * USAGE
 *   BASE_URL=https://<preview>.vercel.app \
 *   SYNTHETIC_TOKEN=<same value as VITE_ANALYTICS_SYNTHETIC_TOKEN> \
 *   node scripts/synthetic-funnel-bot.mjs
 *
 *   Optional: HEADFUL=1 to watch it run; ITERATIONS=3 for repeat happy-paths.
 *   (If chromium isn't installed: `npx playwright install chromium`.)
 *
 * NOTE: the public catalog → start steps below use resilient role/text
 * selectors. The authenticated form steps (sign-in, section fields, file
 * uploads, final submit) are marked TODO — fill them against the real DOM, or
 * ask for a hardened pass. The "blocked submit" path (DIS-197) only needs you
 * to reach /review with required fields empty and click Submit.
 */
import { chromium } from "playwright";

const BASE_URL = (process.env.BASE_URL ?? "").replace(/\/+$/, "");
const SYNTHETIC_TOKEN = process.env.SYNTHETIC_TOKEN ?? "";
const ITERATIONS = Number(process.env.ITERATIONS ?? "1");
const HEADFUL = process.env.HEADFUL === "1";

if (!BASE_URL || !SYNTHETIC_TOKEN) {
  console.error(
    "Set BASE_URL and SYNTHETIC_TOKEN (matching VITE_ANALYTICS_SYNTHETIC_TOKEN on the target deploy).",
  );
  process.exit(1);
}

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

async function run() {
  const browser = await chromium.launch({ headless: !HEADFUL });
  const context = await browser.newContext();
  const page = await context.newPage();
  const ingest = attachIngestCounter(page);

  // 1. Open the doorway: load with the token so PostHog initialises and tags
  //    everything synthetic_test:true. localStorage persists it for the session.
  await page.goto(`${BASE_URL}/?${"kp_synthetic"}=${encodeURIComponent(SYNTHETIC_TOKEN)}`, {
    waitUntil: "networkidle",
  });

  const activated = await page.evaluate(
    () => window.localStorage.getItem("keypath.analytics.synthetic_test"),
  );
  if (!activated) {
    console.warn(
      "⚠️  Synthetic flag not stored — token likely doesn't match the deploy's VITE_ANALYTICS_SYNTHETIC_TOKEN. Events will be dropped.",
    );
  } else {
    console.log("✓ Synthetic-test mode active on this session.");
  }

  for (let i = 0; i < ITERATIONS; i += 1) {
    console.log(`\n— journey ${i + 1}/${ITERATIONS} —`);

    // 2. Catalog → a course (fires $pageview; reaching apply fires
    //    application_start_requested / application_draft_created).
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    const firstCourse = page.getByRole("link", { name: /view|details|apply|explore/i }).first();
    if (await firstCourse.count()) {
      await firstCourse.click().catch(() => {});
      await page.waitForLoadState("networkidle").catch(() => {});
    }

    // 3. Start the application (button text varies — adjust as needed).
    const startBtn = page.getByRole("button", { name: /apply|start application|begin/i }).first();
    if (await startBtn.count()) {
      await startBtn.click().catch(() => {});
      await page.waitForLoadState("networkidle").catch(() => {});
    }

    // 4. TODO (auth): the application flow is gated behind sign-in. Authenticate
    //    a throwaway test account here (password sign-in is most scriptable):
    //      await page.goto(`${BASE_URL}/sign-in`);
    //      await page.getByLabel(/email/i).fill(process.env.TEST_EMAIL);
    //      await page.getByLabel(/password/i).fill(process.env.TEST_PASSWORD);
    //      await page.getByRole("button", { name: /sign in/i }).click();

    // 5. TODO (happy path): walk the section1/* and section2/* steps, filling
    //    required fields, then /review → Submit to fire application_submit_started
    //    and application_submitted. Each tracked step view fires
    //    application_step_viewed; each primary-CTA click fires
    //    application_step_completed.

    // 6. Stuck-point path (DIS-197) — the easy one: land on /review with required
    //    fields still empty and submit → fires application_submit_blocked.
    await page.goto(`${BASE_URL}/review`, { waitUntil: "networkidle" }).catch(() => {});
    const submit = page.getByRole("button", { name: /submit application|submit/i }).first();
    if (await submit.count()) {
      await submit.click().catch(() => {});
      await page.waitForTimeout(1000);
    }
  }

  // Let the final batch flush.
  await page.waitForTimeout(2500);
  console.log(`\n✓ Done. Ingestion POSTs observed: ${ingest.count}`);
  console.log(
    "Check the funnel with the test-account filter OFF to see synthetic_test data.",
  );

  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
