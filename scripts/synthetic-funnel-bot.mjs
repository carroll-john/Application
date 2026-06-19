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
 *   Optional: HEADFUL=1 to watch it run; ITERATIONS=3 for repeat journeys.
 *   TEST_EMAIL/TEST_PASSWORD enable sign-in (required for the gated steps);
 *   COURSE_PATH (e.g. /courses/<slug>) is a fallback if the catalog button
 *   selector misses. (If chromium isn't installed: `npx playwright install chromium`.)
 *
 * NOTE: sign-in (password) and the public catalog → start → blocked-submit path
 * are wired. The happy-path section field-filling + final submit is still TODO —
 * fill it against the real DOM, or ask for a hardened pass. Without
 * TEST_EMAIL/TEST_PASSWORD the auth-gated steps are skipped with a warning
 * (never silently reported as success).
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

/**
 * Sign in with a throwaway test account. The application flow (/review, the
 * section steps, submit) is behind AuthRequiredLayout, so without this the
 * gated steps redirect to /sign-in and never fire their events. Returns whether
 * the session ended up authenticated.
 */
async function signIn(page) {
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;
  if (!email || !password) {
    console.warn(
      "⚠️  No TEST_EMAIL/TEST_PASSWORD set — skipping sign-in. Auth-gated steps will be skipped; only public catalog events will fire.",
    );
    return false;
  }

  await page.goto(`${BASE_URL}/sign-in`, { waitUntil: "networkidle" });
  await page.getByLabel(/email/i).fill(email).catch(() => {});
  await page.getByLabel(/password/i).fill(password).catch(() => {});
  await page
    .getByRole("button", { name: /sign in|log in/i })
    .first()
    .click()
    .catch(() => {});
  await page.waitForLoadState("networkidle").catch(() => {});

  const authed = !page.url().includes("/sign-in");
  console.log(
    authed ? "✓ Signed in." : "⚠️  Sign-in did not complete (still on /sign-in).",
  );
  return authed;
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

  // 2. Auth: the application flow is gated behind sign-in. Do it once up front;
  //    without it the gated steps below are skipped (not silently "passed").
  const authed = await signIn(page);

  for (let i = 0; i < ITERATIONS; i += 1) {
    console.log(`\n— journey ${i + 1}/${ITERATIONS} —`);

    // 3. Catalog → a course. CourseBrowseCard renders "View course" as a
    //    <Button> (role button), not a link. Fall back to a known course URL.
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    const viewCourse = page.getByRole("button", { name: /view course/i }).first();
    if (await viewCourse.count()) {
      await viewCourse.click().catch(() => {});
      await page.waitForLoadState("networkidle").catch(() => {});
    } else if (process.env.COURSE_PATH) {
      await page.goto(`${BASE_URL}${process.env.COURSE_PATH}`, { waitUntil: "networkidle" });
    } else {
      console.warn(
        "⚠️  No 'View course' button found and no COURSE_PATH set — staying on the catalog.",
      );
    }

    // 4. Start the application — fires application_start_requested /
    //    application_draft_created (button label may need adjusting).
    const startBtn = page.getByRole("button", { name: /apply|start application|begin/i }).first();
    if (await startBtn.count()) {
      await startBtn.click().catch(() => {});
      await page.waitForLoadState("networkidle").catch(() => {});
    }

    // 5. TODO (happy path): walk the section1/* and section2/* steps, filling
    //    required fields, then /review → Submit to fire application_submit_started
    //    and application_submitted. Each tracked step view fires
    //    application_step_viewed; each primary-CTA click fires
    //    application_step_completed. Requires `authed` to be true.

    // 6. Stuck-point path (DIS-197): land on /review with required fields empty
    //    and submit → fires application_submit_blocked. /review is auth-gated,
    //    so this only works when signed in.
    await page.goto(`${BASE_URL}/review`, { waitUntil: "networkidle" }).catch(() => {});
    if (!authed || page.url().includes("/sign-in")) {
      console.warn(
        "⚠️  /review is behind auth — not signed in, so application_submit_blocked was NOT exercised. Set TEST_EMAIL/TEST_PASSWORD.",
      );
      continue;
    }
    const submit = page.getByRole("button", { name: /submit application|submit/i }).first();
    if (await submit.count()) {
      await submit.click().catch(() => {});
      await page.waitForTimeout(1000);
    } else {
      console.warn("⚠️  No submit button found on /review.");
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
