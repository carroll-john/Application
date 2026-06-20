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
 *   PERSONA=career-changer|school-leaver|international-applicant (default
 *   career-changer; see scripts/synthetic-personas.mjs — personas set the field
 *   values and a drop-off behaviour). MODE=happy|blocked|both (default both) ·
 *   ITERATIONS=1 · HEADFUL=1 to watch · COURSE_PATH=/courses/<slug> (fallback if
 *   the catalog button selector misses) · TRANSCRIPT_PATH / CV_PATH to upload
 *   real documents and exercise the parsers + AI eligibility ·
 *   VERCEL_BYPASS=<secret> to pass Vercel deployment protection (Protection
 *   Bypass for Automation), needed when the preview is password-walled.
 *   (If chromium isn't installed: `npx playwright install chromium`.)
 *   Easiest way to run this without a local setup: the "Synthetic funnel bot"
 *   GitHub Action (.github/workflows/synthetic-bot.yml) — Actions tab → Run.
 *
 * The app's selects are a custom `NativeSelect` (a button[role=combobox] over a
 * hidden <select>), so we open the combobox and click a role=option rather than
 * calling selectOption(). Submissions write Supabase rows and can trigger the
 * eligibility AI / emails — run against preview and clean up after.
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright";
import { getPersona } from "./synthetic-personas.mjs";

const BASE_URL = (process.env.BASE_URL ?? "").replace(/\/+$/, "");
const SYNTHETIC_TOKEN = process.env.SYNTHETIC_TOKEN ?? "";
const TEST_EMAIL = process.env.TEST_EMAIL ?? "";
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "";
const MODE = (process.env.MODE ?? "both").toLowerCase(); // happy | blocked | both
const ITERATIONS = Number(process.env.ITERATIONS ?? "1");
const HEADFUL = process.env.HEADFUL === "1";
// Vercel "Protection Bypass for Automation" secret. When the preview has
// deployment protection on, this header lets the automated browser through
// (harmless if the preview is public / the secret is unset).
const VERCEL_BYPASS = process.env.VERCEL_BYPASS ?? "";
const persona = getPersona(process.env.PERSONA ?? "career-changer");

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
  await f.waitFor({ state: "visible", timeout: 3000 }).catch(() => {});
  if (await f.count()) {
    await f.fill(String(value)).catch(() => {});
    return true;
  }
  warn(`field not found: ${labelRe}`);
  return false;
}

/** Fill an input by placeholder (for fields whose <Label> isn't associated). */
async function fillByPlaceholder(page, placeholderRe, value, { dismiss = false } = {}) {
  const f = page.getByPlaceholder(placeholderRe).first();
  await f.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  if (!(await f.count())) {
    warn(`field (placeholder) not found: ${placeholderRe}`);
    return false;
  }
  await f.fill(String(value)).catch(() => {});
  if (dismiss) {
    await page.waitForTimeout(400);
    await page.keyboard.press("Escape").catch(() => {}); // dismiss autocomplete dropdown
  }
  return true;
}

/** A persona value (regex/string) picks that option; null/undefined → first valid. */
function optionOrPick(value) {
  return value == null ? {} : { option: value };
}

/** Escape a string for safe use inside a RegExp. */
function escapeRe(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Fill a react-datepicker DOB field (custom button trigger + calendar). Open it,
 * set month + year via the header NativeSelect comboboxes, then click the day.
 * `iso` is YYYY-MM-DD.
 */
async function fillDateOfBirth(page, iso, triggerSelector = "#dateOfBirth") {
  if (!iso) return false;
  const [yy, mm, dd] = iso.split("-");
  let trigger = page.locator(triggerSelector).first();
  await trigger.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  if (!(await trigger.count())) {
    // fall back to the trigger button by its empty-state placeholder
    trigger = page.getByRole("button", { name: /DD\s*\/\s*MM\s*\/\s*YYYY|select date/i }).first();
    await trigger.waitFor({ state: "visible", timeout: 3000 }).catch(() => {});
  }
  if (!(await trigger.count())) {
    warn(`date picker not found: ${triggerSelector}`);
    return false;
  }
  await trigger.click().catch(() => {});
  const cal = page.locator(".react-datepicker").first();
  const opened = await cal.waitFor({ state: "visible", timeout: 6000 }).then(() => true).catch(() => false);
  if (!opened) {
    warn("date picker calendar did not open");
    return false;
  }
  const combos = cal.getByRole("combobox");
  await combos.nth(0).click().catch(() => {}); // month
  await page.getByRole("option", { name: new RegExp(`^${MONTHS[Number(mm) - 1]}$`, "i") }).first().click().catch(() => {});
  await combos.nth(1).click().catch(() => {}); // year
  await page.getByRole("option", { name: new RegExp(`^${Number(yy)}$`) }).first().click().catch(() => {});
  await cal
    .locator(`.react-datepicker__day--0${dd}:not(.react-datepicker__day--outside-month)`)
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(300);
  log(`date set to ${iso} (${triggerSelector})`);
  return true;
}

/**
 * Fill a MonthYearPickerField (react-datepicker month grid). `index` selects which
 * "Select month and year" trigger on the page (0-based). `monthIdx` is 0-11.
 */
async function fillMonthYear(page, index, monthIdx, year) {
  const trigger = page.getByRole("button", { name: /Select month and year/i }).nth(index);
  if (!(await trigger.count())) {
    warn(`month-year picker #${index} not found`);
    return false;
  }
  await trigger.click().catch(() => {});
  const cal = page.locator(".react-datepicker").first();
  const opened = await cal.waitFor({ state: "visible", timeout: 6000 }).then(() => true).catch(() => false);
  if (!opened) {
    warn("month-year calendar did not open");
    return false;
  }
  const yearCombo = cal.getByRole("combobox").nth(1); // header: month (0), year (1)
  if (await yearCombo.count()) {
    await yearCombo.click().catch(() => {});
    await page.getByRole("option", { name: new RegExp(`^${year}$`) }).first().click().catch(() => {});
  }
  await cal.locator(`.react-datepicker__month-${monthIdx}`).first().click().catch(() => {});
  await page.waitForTimeout(300);
  log(`month/year set to ${MONTHS[monthIdx]} ${year} (#${index})`);
  return true;
}

/**
 * Set a MonthYearPickerField located by its field label (e.g. "Start date" /
 * "End date"), working whether the picker is empty or already filled — so we can
 * deterministically override whatever the transcript parser drafted and guarantee a
 * valid, in-order date range. `monthIdx` is 0-11.
 */
async function setStudyDate(page, labelRe, monthIdx, year) {
  const label = page.locator("label").filter({ hasText: labelRe }).first();
  if (!(await label.count())) {
    warn(`study-date label not found: ${labelRe}`);
    return false;
  }
  // The picker trigger is the first button after the label (filled triggers show the
  // date, empty ones show "Select month and year", so don't match on the text).
  const trigger = label.locator("xpath=following::button[1]");
  if (!(await trigger.count())) {
    warn(`study-date trigger not found: ${labelRe}`);
    return false;
  }
  await trigger.scrollIntoViewIfNeeded().catch(() => {});
  await trigger.click().catch(() => {});
  const cal = page.locator(".react-datepicker").first();
  const opened = await cal
    .waitFor({ state: "visible", timeout: 6000 })
    .then(() => true)
    .catch(() => false);
  if (!opened) {
    warn(`study-date calendar did not open: ${labelRe}`);
    return false;
  }
  const yearCombo = cal.getByRole("combobox").nth(1); // header: month (0), year (1)
  if (await yearCombo.count()) {
    await yearCombo.click().catch(() => {});
    await page.getByRole("option", { name: new RegExp(`^${year}$`) }).first().click().catch(() => {});
  }
  await cal.locator(`.react-datepicker__month-${monthIdx}`).first().click().catch(() => {});
  await page.waitForTimeout(300);
  log(`study date "${labelRe.source ?? labelRe}" set to ${MONTHS[monthIdx]} ${year}`);
  return true;
}

/** Upload a persona document (transcript/CV) into the first file input on the page. */
async function uploadFile(page, path) {
  if (!path) return false;
  if (!existsSync(path)) {
    warn(`document not found, skipping upload: ${path}`);
    return false;
  }
  const input = page.locator('input[type="file"]').first();
  // The upload control is a lazy route + an sr-only <input type=file>; wait for it
  // to mount (it's hidden, so "attached" — not "visible" — is the right state).
  await input.waitFor({ state: "attached", timeout: 10000 }).catch(() => {});
  if (!(await input.count())) {
    warn("no file input on this page — skipping upload.");
    return false;
  }
  await input
    .setInputFiles(path)
    .catch((e) => warn(`setInputFiles failed: ${e?.message ?? e}`));
  log(`uploaded ${path}`);
  await page.waitForTimeout(2000); // let the parser kick off
  return true;
}

/** Locate a NativeSelect's combobox button by accessible name, else by label text. */
async function findCombobox(page, labelRe) {
  const byName = page.getByRole("combobox", { name: labelRe }).first();
  // Section steps are lazy routes — give the control a moment to render.
  await byName.waitFor({ state: "visible", timeout: 3000 }).catch(() => {});
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
 * Set a NativeSelect's underlying hidden <select> directly and fire a real change
 * event, so React's onChange runs even when the combobox UI click doesn't take.
 * Bypasses React's value tracker via the native setter (the standard pattern), so
 * controlled state updates. Returns the chosen value, or null if nothing matched.
 */
async function setNativeSelectDirect(combo, { source = null, flags = "", pick = "first" }) {
  return combo
    .evaluate(
      (btn, a) => {
        const root = btn.closest("div");
        const select = root ? root.querySelector("select") : null;
        if (!select) return null;
        const all = Array.from(select.options);
        let chosen = null;
        if (a.source != null) {
          const re = new RegExp(a.source, a.flags);
          chosen = all.find(
            (o) => re.test((o.textContent || "").trim()) || re.test(o.value),
          );
        } else {
          const real = all.filter((o) => o.value !== "");
          chosen = a.pick === "last" ? real[real.length - 1] : real[0];
        }
        if (!chosen) return null;
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLSelectElement.prototype,
          "value",
        ).set;
        setter.call(select, chosen.value);
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
        return chosen.value;
      },
      { source, flags, pick },
    )
    .catch(() => null);
}

/**
 * Drive a NativeSelect: open it and click an option, then verify the combobox's
 * displayed value actually changed. If the UI click silently fails to commit
 * (some lazy/upward-opening selects don't), fall back to setting the hidden
 * <select> directly so the value always lands.
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

  // A regex used both to find the listbox option and to verify the result.
  const optionRe =
    option == null
      ? null
      : option instanceof RegExp
        ? option
        : new RegExp(exact ? `^${escapeRe(String(option))}$` : escapeRe(String(option)), "i");

  const readDisplay = async () => (await combo.innerText().catch(() => "")).trim();
  const before = await readDisplay();

  // Primary path: drive the real combobox UI (keeps session replays realistic).
  for (let attempt = 0; attempt < 2; attempt += 1) {
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
      if (attempt === 0) {
        await page.keyboard.press("Escape").catch(() => {});
        continue; // listbox may not have opened yet — try once more
      }
      break;
    }
    await target.click().catch(() => {});
    await page.waitForTimeout(200); // let React commit onChange
    const after = await readDisplay();
    if (after && after !== before && (!optionRe || optionRe.test(after))) {
      return true; // selection visibly landed
    }
    await page.keyboard.press("Escape").catch(() => {});
  }

  // Fallback: the UI click didn't commit — set the hidden <select> directly.
  const set = await setNativeSelectDirect(combo, {
    source: optionRe ? optionRe.source : null,
    flags: optionRe ? optionRe.flags : "",
    pick,
  });
  if (set) {
    await page.waitForTimeout(150);
    log(`select(${labelRe}) committed via fallback → "${set}"`);
    return true;
  }
  warn(`no matching option for ${labelRe} (combobox shows "${await readDisplay()}")`);
  return false;
}

async function clickButton(page, nameRe, { required = false } = {}) {
  const b = page.getByRole("button", { name: nameRe }).first();
  // Buttons live on lazy routes too — wait for render before giving up.
  await b.waitFor({ state: "visible", timeout: required ? 8000 : 2500 }).catch(() => {});
  if (await b.count()) {
    await b.click().catch(() => {});
    return true;
  }
  (required ? warn : log)(`button not found: ${nameRe}`);
  return false;
}

async function continueStep(page) {
  const before = page.url();
  if (!(await clickButton(page, /^(Continue|Save & Continue|Next)$/i, { required: true }))) return;
  // SPA route changes fire after the save resolves — wait for the URL, not networkidle.
  await page.waitForURL((u) => u.toString() !== before, { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(300);
  if (page.url() === before) {
    warn(`did not advance from ${new URL(before).pathname} (validation may have blocked it)`);
  } else {
    log(`→ ${new URL(page.url()).pathname}`);
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
  await page.goto(`${BASE_URL}/sign-in`, { waitUntil: "domcontentloaded" });
  // /sign-in is a lazy route — wait for the form to render before filling.
  await page.getByLabel(/^Email/i).first().waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
  const emailOk = await fillField(page, /^Email/i, TEST_EMAIL);
  const pwOk = await fillField(page, /^Password/i, TEST_PASSWORD);
  log(`sign-in: email field ${emailOk ? "filled" : "NOT FOUND"}, password field ${pwOk ? "filled" : "NOT FOUND"}`);
  // Submit the form's own submit button (falling back to Enter) so we can't
  // accidentally click a same-named nav/tab control instead of submitting.
  const submit = page.locator('button[type="submit"]').first();
  if (await submit.count()) await submit.click().catch(() => {});
  else await page.getByLabel(/^Password/i).press("Enter").catch(() => {});
  await page.waitForTimeout(4000); // auth round-trip + redirect (networkidle never settles here)
  const authed = !page.url().includes("/sign-in");
  if (authed) {
    log("✓ Signed in.");
  } else {
    const msg = await page
      .evaluate(() => document.body.innerText.replace(/\s+/g, " ").trim().slice(0, 300))
      .catch(() => "");
    warn(`Sign-in did not complete (still on /sign-in). Page text: "${msg}"`);
  }
  return authed;
}

/** Catalog → course details. */
async function openCourse(page) {
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
  const viewCourse = page.getByRole("button", { name: /view course/i }).first();
  // Cards render from bundled data after hydration, which can land after the
  // network goes idle — wait for the button rather than checking immediately.
  await viewCourse.waitFor({ state: "visible", timeout: 12000 }).catch(() => {});
  if (await viewCourse.count()) {
    await viewCourse.click().catch(() => {});
    await page.waitForLoadState("networkidle").catch(() => {});
  } else if (process.env.COURSE_PATH) {
    await page.goto(`${BASE_URL}${process.env.COURSE_PATH}`, { waitUntil: "networkidle" });
  } else {
    const snippet = await page
      .evaluate(() => document.body.innerText.replace(/\s+/g, " ").trim().slice(0, 200))
      .catch(() => "");
    warn(`No 'View course' button. At ${page.url()} — page text: "${snippet}"`);
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
  const pick = persona.eligibility?.pick ?? "last";
  await selectField(page, /Education level/i, { pick });
  await selectField(page, /Experience/i, { pick }); // conditional; warns if absent
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
  await page.waitForURL(/\/(overview|section1)/, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(500);
  log(`application started — at ${new URL(page.url()).pathname}`);
  return true;
}

/** A fresh draft lands on /overview; click its CTA through to Section 1. */
async function enterSections(page) {
  await page.waitForURL(/\/(overview|section1)/, { timeout: 20000 }).catch(() => {});
  log(`enterSections — at ${new URL(page.url()).pathname}`);
  for (let i = 0; i < 3 && page.url().includes("/overview"); i += 1) {
    const cta = page
      .getByRole("button", {
        name: /start application|continue to next step|go to review|^continue$|resume|begin/i,
      })
      .first();
    await cta.waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
    if (!(await cta.count())) {
      const names = await page.getByRole("button").allInnerTexts().catch(() => []);
      warn(`overview continue CTA not found. buttons=${JSON.stringify(names.filter(Boolean)).slice(0, 400)}`);
      break;
    }
    await cta.click().catch(() => {});
    await page.waitForURL((u) => !u.toString().includes("/overview"), { timeout: 15000 }).catch(() => {});
    log(`after overview CTA — at ${new URL(page.url()).pathname}`);
  }
}

/** Fill the six Section 1 steps from the persona's profile. */
async function fillSection1(page) {
  const p = persona.profile;
  await page.waitForURL(/\/section1\/basic-info/, { timeout: 12000 }).catch(() => {});
  log(`Section 1 — at ${new URL(page.url()).pathname}`);
  // basic-info
  await selectField(page, /^Title/, optionOrPick(p.title));
  await fillField(page, /^First name/, p.firstName);
  await fillField(page, /^Last name/, p.lastName);
  await continueStep(page);
  // personal-contact
  await selectField(page, /^Gender/, optionOrPick(p.gender));
  await fillDateOfBirth(page, p.dob);
  await fillField(page, /^Email/i, TEST_EMAIL || "synthetic@example.com");
  await fillField(page, /^Phone/i, p.phone);
  await continueStep(page);
  if (persona.behavior?.dropOffAt === "section1") return; // abandon mid-section
  // contact-info (citizenship)
  await selectField(page, /^Status/, optionOrPick(p.citizenship));
  await continueStep(page);
  // address
  await fillField(page, /residential address/i, p.residentialAddress);
  await page.waitForTimeout(600);
  await page.keyboard.press("Escape").catch(() => {}); // dismiss any autocomplete dropdown
  await continueStep(page);
  // cultural-background
  await selectField(page, /^Language/, optionOrPick(p.language));
  await selectField(page, /^Status/, optionOrPick(p.aboriginalStatus)); // Aboriginal/TSI status
  await selectField(page, /School level/i, optionOrPick(p.schoolLevel));
  await continueStep(page);
  // family-support
  await selectField(page, /parents|guardians/i, { option: String(p.parents ?? "2"), exact: true });
  for (let i = 1; i <= 5; i += 1) {
    const labelRe = new RegExp(`Parent/Guardian ${i}`, "i");
    if (await findCombobox(page, labelRe)) await selectField(page, labelRe);
    else break;
  }
  // Disability question — the "No" radio's name is the full sentence, not "No".
  await page.getByRole("radio", { name: /do not have a disability/i }).first().check().catch(() => {});
  await continueStep(page);
}

/** Section 2: add the persona's tertiary qualification (satisfies submit validation). */
async function addTertiary(page) {
  const t = persona.tertiary;
  // The Tertiary card's CTA is a generic "Add" (+) button; it's the first card,
  // so the first "Add" on the qualifications page → /section2/add-tertiary.
  const addBtn = page.getByRole("button", { name: /^Add$/i }).first();
  await addBtn.waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
  await addBtn.click().catch(() => {});
  await page.waitForURL(/add-tertiary/, { timeout: 12000 }).catch(() => {});
  const transcript = persona.documents?.transcript ?? process.env.TRANSCRIPT_PATH;
  if (transcript) {
    // The transcript is a required document; uploading it also kicks off the parser
    // + AI eligibility, which auto-fills the form and gates Save until it finishes.
    await uploadFile(page, transcript);
    log("transcript uploaded — waiting for parse/eligibility to settle…");
    await page
      .getByText(/parsing|checking eligibility|analy[sz]ing|reading your transcript/i)
      .first()
      .waitFor({ state: "hidden", timeout: 90000 })
      .catch(() => {});
    await page.waitForTimeout(1500);
  }
  // Fill the required fields, overriding whatever the parser drafted so the record is
  // deterministic and valid regardless of how the AI parse turned out this run.
  await fillByPlaceholder(page, /start typing institution/i, t.institution, { dismiss: true });
  await selectField(page, /Qualification level/i, optionOrPick(t.level));
  await fillByPlaceholder(page, /Bachelor of Science/i, t.course);
  // Always set both study dates explicitly (overriding the parser, which fills them
  // non-deterministically — sometimes only one, risking an out-of-order range that
  // blocks Save). February 2015 → November 2018 is always valid and in order.
  await setStudyDate(page, /Start date/i, 1, 2015);
  await setStudyDate(page, /End date/i, 10, 2018);
  // Save & Continue — wait for it to become enabled (parse/save gating).
  const save = page.getByRole("button", { name: /^Save & Continue$/i }).first();
  await save.waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
  for (let i = 0; i < 30 && (await save.isDisabled().catch(() => false)); i += 1) {
    await page.waitForTimeout(1000);
  }
  if (await save.isDisabled().catch(() => false)) {
    warn("tertiary Save & Continue stayed disabled (a required field/date range is invalid).");
  }
  await save.click().catch(() => {});
  await page.waitForURL(/section2\/qualifications/, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1000); // back on the qualifications list with the saved record
  if (page.url().includes("/add-tertiary")) {
    warn(`tertiary save did not navigate — still at ${new URL(page.url()).pathname}`);
  } else {
    log(`tertiary saved — at ${new URL(page.url()).pathname}`);
  }
}

/**
 * Wait for the qualifications-hub primary CTA to be present and enabled. After a
 * tertiary record with a transcript is saved, the hub kicks off a *deferred* AI
 * eligibility check; while it runs the CTA reads "Checking eligibility..." and is
 * disabled, so we poll for the real, enabled "Save & Continue" / "Return to Review".
 */
async function waitForQualificationsReady(page) {
  const cta = page
    .getByRole("button", { name: /^(Save & Continue|Return to Review)$/i })
    .first();
  for (let i = 0; i < 100; i += 1) {
    if ((await cta.count()) && !(await cta.isDisabled().catch(() => true))) {
      return cta;
    }
    if (i === 0) log("waiting for qualifications hub (eligibility check) to settle…");
    await page.waitForTimeout(1000);
  }
  warn("qualifications continue CTA never became ready (eligibility still processing?)");
  return null;
}

/** Click the qualifications-hub primary CTA through to /review (once it's ready). */
async function continueFromQualifications(page) {
  const cta = await waitForQualificationsReady(page);
  if (!cta) return false;
  await cta.scrollIntoViewIfNeeded().catch(() => {});
  await cta.click().catch(() => {});
  return true;
}

/**
 * The deferred hub eligibility re-parses the transcript and overwrites the saved
 * tertiary record with the AI's extraction, which can leave required fields (level,
 * end date) blank — blocking submit. Once the hub has settled, edit the record to
 * restore complete, valid values. Editing without re-selecting the transcript does
 * NOT re-trigger the hub (eligibility is already cached), so these corrections stick.
 */
async function correctTertiaryRecord(page) {
  const t = persona.tertiary;
  if (!t) return false;
  await waitForQualificationsReady(page); // let the hub finish overwriting first
  const fileName = (persona.documents?.transcript ?? "").split("/").pop() ?? "";
  // The tertiary row is the rounded list card showing the transcript filename; its
  // first button is the (icon-only) Edit action.
  const row = fileName
    ? page.locator("div.rounded.border").filter({ hasText: fileName }).first()
    : page.locator("div.rounded.border").first();
  const editBtn = row.getByRole("button").first();
  await editBtn.waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
  if (!(await editBtn.count())) {
    warn("tertiary Edit button not found — skipping record correction.");
    return false;
  }
  await editBtn.scrollIntoViewIfNeeded().catch(() => {});
  await editBtn.click().catch(() => {});
  await page.waitForURL(/edit-tertiary/, { timeout: 12000 }).catch(() => {});
  if (!page.url().includes("edit-tertiary")) {
    warn(`tertiary edit did not open — at ${new URL(page.url()).pathname}`);
    return false;
  }
  await page.waitForTimeout(800); // let the edit form render
  await fillByPlaceholder(page, /start typing institution/i, t.institution, { dismiss: true });
  await selectField(page, /Qualification level/i, optionOrPick(t.level));
  await fillByPlaceholder(page, /Bachelor of Science/i, t.course);
  await setStudyDate(page, /Start date/i, 1, 2015);
  await setStudyDate(page, /End date/i, 10, 2018);
  const save = page.getByRole("button", { name: /^Save & Continue$/i }).first();
  await save.waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
  for (let i = 0; i < 20 && (await save.isDisabled().catch(() => false)); i += 1) {
    await page.waitForTimeout(1000);
  }
  if (await save.isDisabled().catch(() => false)) {
    warn("tertiary edit Save stayed disabled (a required field is still invalid).");
  }
  await save.click().catch(() => {});
  await page.waitForURL(/section2\/qualifications/, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1000);
  log(`tertiary corrected — at ${new URL(page.url()).pathname}`);
  return true;
}

/**
 * Upload the persona's CV. Reached client-side from the qualifications hub via the
 * CV card's Add button (a full reload would wipe the in-memory application context).
 * The CV parser drafts employment history, so we wait for it to settle before saving.
 */
async function addCv(page) {
  const cv = persona.documents?.cv ?? process.env.CV_PATH;
  if (!cv) return false;
  if (!page.url().includes("/section2/qualifications")) {
    warn(`not on qualifications for CV upload — at ${new URL(page.url()).pathname}`);
    return false;
  }
  const cvCard = page
    .locator("div.rounded-lg.border")
    .filter({ hasText: /Curriculum Vitae/i })
    .first();
  const cvAdd = cvCard.getByRole("button", { name: /^(Add|Replace)$/i }).first();
  await cvAdd.waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
  if (!(await cvAdd.count())) {
    warn("CV card Add button not found — skipping CV upload.");
    return false;
  }
  await cvAdd.scrollIntoViewIfNeeded().catch(() => {});
  await cvAdd.click().catch(() => {});
  await page.waitForURL(/add-cv/, { timeout: 12000 }).catch(() => {});
  if (!page.url().includes("add-cv")) {
    warn(`CV page did not open — at ${new URL(page.url()).pathname}`);
    return false;
  }
  await page.waitForTimeout(600);
  if (!(await uploadFile(page, cv))) return false;
  log("CV uploaded — waiting for the CV parser to settle…");
  await page
    .getByText(/reading your cv|drafting employment|parsing|analy[sz]ing/i)
    .first()
    .waitFor({ state: "hidden", timeout: 90000 })
    .catch(() => {});
  await page.waitForTimeout(1000);
  const save = page.getByRole("button", { name: /^Save & Continue$/i }).first();
  await save.waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
  for (let i = 0; i < 30 && (await save.isDisabled().catch(() => false)); i += 1) {
    await page.waitForTimeout(1000);
  }
  await save.click().catch(() => {});
  await page.waitForURL(/section2\/qualifications/, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1000);
  log(`CV saved — at ${new URL(page.url()).pathname}`);
  return true;
}

/** Submit and verify we reach /submitted. */
async function submitHappy(page) {
  // Reach /review via the UI only — a full reload wipes the in-memory application
  // context (everything entered this session), which fails review validation.
  if (!page.url().includes("/review")) {
    await continueFromQualifications(page); // qualifications → review (waits out eligibility)
    await page.waitForURL(/\/review/, { timeout: 15000 }).catch(() => {});
  }
  if (!page.url().includes("/review")) {
    warn(`could not reach /review client-side — at ${new URL(page.url()).pathname}`);
    return false;
  }
  // Let the review page's validation settle before submitting — clicking while it's
  // still computing can fire application_submit_blocked and not navigate.
  await page
    .getByText(/all required fields are complete|ready to submit/i)
    .first()
    .waitFor({ state: "visible", timeout: 10000 })
    .catch(() => {});
  const submit = page.getByRole("button", { name: /^Submit application$/i }).first();
  await submit.waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
  if (!(await submit.count())) {
    warn(`Submit button not found at ${new URL(page.url()).pathname}`);
    return false;
  }
  // The submit writes the whole record to Supabase before navigating, which can take
  // a while; click, wait generously, and retry once if it doesn't land.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await submit.click().catch(() => {});
    await page.waitForURL(/\/submitted/, { timeout: 20000 }).catch(() => {});
    if (page.url().includes("/submitted")) {
      log("✅ Reached /submitted — application_submitted fired.");
      return true;
    }
    await page.waitForTimeout(1500);
  }
  const txt = await page
    .evaluate(() => document.body.innerText.replace(/\s+/g, " ").trim().slice(0, 400))
    .catch(() => "");
  warn(`Did not reach /submitted. At ${new URL(page.url()).pathname} — page says: "${txt}"`);
  return false;
}

async function runHappy(page) {
  const drop = persona.behavior?.dropOffAt ?? null;
  console.log(`\n=== happy path · ${persona.label} ===`);
  await openCourse(page);
  if (!(await startApplication(page))) return;
  await enterSections(page);
  await fillSection1(page);
  if (drop === "section1") {
    log("↩︎ persona abandons during Section 1 (expected drop-off).");
    return;
  }
  if (!page.url().includes("/section2/qualifications")) {
    await page.goto(`${BASE_URL}/section2/qualifications`, { waitUntil: "networkidle" }).catch(() => {});
  }
  if (drop === "qualifications") {
    log("↩︎ persona abandons at qualifications (expected drop-off).");
    return;
  }
  if (persona.tertiary) {
    await addTertiary(page);
    await correctTertiaryRecord(page); // restore fields the hub re-parse may have blanked
  } else {
    await continueStep(page);
  }
  await addCv(page); // no-op unless the persona supplies a CV
  if (drop === "review") {
    if (!page.url().includes("/review")) {
      await page.goto(`${BASE_URL}/review`, { waitUntil: "networkidle" }).catch(() => {});
    }
    log("↩︎ persona reviews but does not submit (expected drop-off).");
    return;
  }
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
  const context = await browser.newContext(
    VERCEL_BYPASS
      ? {
          extraHTTPHeaders: {
            "x-vercel-protection-bypass": VERCEL_BYPASS,
            "x-vercel-set-bypass-cookie": "true",
          },
        }
      : {},
  );
  const page = await context.newPage();
  const ingest = attachIngestCounter(page);

  console.log(`Persona: ${persona.label} (MODE=${MODE})`);
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
