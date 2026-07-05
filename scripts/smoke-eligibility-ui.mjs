#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_PDF = path.join(
  REPO_ROOT,
  "tests/fixtures/transcript-v3/pdfs/AU-TX-V3-001_the_university_of_melbourne.pdf",
);

const BASE = process.env.SMOKE_BASE_URL?.trim() || "https://application-prototype.vercel.app";
const EMAIL = process.env.SMOKE_EMAIL?.trim() || "";
const PASSWORD = process.env.SMOKE_PASSWORD?.trim() || "";
const MODE = process.argv.includes("--unsafe") ? "unsafe" : "safe";

const SAFE_COURSE = {
  slug: "la-trobe-university-master-of-information-technology",
  title: "Master of Information Technology",
  expectedRows: 2,
};

const UNSAFE_COURSE = {
  slug: "master-of-business-marketing",
  title: "Master of Business (Marketing)",
  expectedRows: 2,
  expectedRulesFragment: "deterministic-v1",
};

if (!EMAIL || !PASSWORD) {
  console.error("Set SMOKE_EMAIL and SMOKE_PASSWORD to run the prod UI smoke.");
  process.exit(1);
}

const course = MODE === "unsafe" ? UNSAFE_COURSE : SAFE_COURSE;
const pdfPath = process.env.SMOKE_TRANSCRIPT_PDF?.trim() || DEFAULT_PDF;

async function startFreshApplication(page, courseSlug, courseTitle) {
  await page.goto(`${BASE}/courses/${courseSlug}?apply=1&eligible=1`, {
    waitUntil: "networkidle",
  });

  const startFresh = page.getByRole("button", { name: "Start brand new application" });
  if (await startFresh.isVisible({ timeout: 12000 }).catch(() => false)) {
    await startFresh.click();
    await page.waitForURL("**/overview**", { timeout: 30000 });
    await expectCourse(page, courseTitle);
    return;
  }

  if (page.url().includes("/overview")) {
    await expectCourse(page, courseTitle);
    return;
  }

  await page.goto(`${BASE}/courses/${courseSlug}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Eligibility Check" }).click();
  await page.getByRole("button", { name: /Start application|Apply now/i }).click();
  await startFresh.waitFor({ timeout: 15000 });
  await startFresh.click();
  await page.waitForURL("**/overview**", { timeout: 30000 });
  await expectCourse(page, courseTitle);
}

async function expectCourse(page, title) {
  await page.getByRole("heading", { name: title }).first().waitFor({ timeout: 15000 });
  console.log("OK active course:", title, "at", page.url());
}

async function pickMonthYear(page, trigger, year, monthName) {
  await trigger.click();
  await page.getByRole("combobox").filter({ hasText: /20\d{2}/ }).last().click();
  await page.getByRole("option", { name: String(year) }).click();
  await page
    .getByRole("option", { name: new RegExp(`Choose ${monthName} ${year}`) })
    .click();
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
let latestRulesVersion = null;

page.on("response", async (response) => {
  if (!response.url().includes("/api/evaluate-transcript-eligibility")) {
    return;
  }

  try {
    const payload = await response.json();
    if (typeof payload?.rulesVersion === "string") {
      latestRulesVersion = payload.rulesVersion;
    }
  } catch {
    // Ignore non-JSON responses.
  }
});

try {
  await page.goto(`${BASE}/sign-in?redirect=${encodeURIComponent("/overview")}`);
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.locator("form").getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/overview**", { timeout: 30000 });
  console.log("OK signed in ->", page.url());

  await startFreshApplication(page, course.slug, course.title);

  await page.goto(`${BASE}/section2/add-tertiary`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Add Tertiary Qualification" }).waitFor({
    timeout: 20000,
  });

  await page.locator('input[type="file"]').first().setInputFiles(pdfPath);
  console.log("OK transcript file attached (parse-first):", path.basename(pdfPath));

  await page.getByRole("button", { name: "Save & Continue" }).click();
  await page.waitForURL("**/section2/qualifications**", { timeout: 120000 });
  console.log("OK saved tertiary via parse-first ->", page.url());

  await page.getByText(/checking course eligibility from your transcript/i).waitFor({
    timeout: 15000,
  }).catch(() => {
    console.log("Note: hub eligibility progress not shown (cached assessment or no transcript)");
  });

  await page.getByText(/saved a qualification drafted from your transcript/i).waitFor({
    timeout: 120000,
  }).catch(() => {
    console.log("Note: hub eligibility success flash not shown");
  });

  const tertiaryItem = page
    .locator("text=/Tertiary Qualification|Bachelor|Information Technology|University of Melbourne/i")
    .first();
  await tertiaryItem.waitFor({ timeout: 15000 });
  console.log("OK tertiary list item visible after parse-first save");

  await page.getByRole("heading", { name: "Transcript eligibility check" }).waitFor({
    timeout: 30000,
  });

  const rows = page.locator('[aria-label="Eligibility requirements"] li');
  const count = await rows.count();
  console.log("Eligibility rows:", count);

  if (MODE === "unsafe") {
    if (!latestRulesVersion?.includes("deterministic")) {
      throw new Error(
        `Expected legacy deterministic rules, got rulesVersion=${latestRulesVersion ?? "(missing)"}`,
      );
    }
    console.log("OK legacy rules:", latestRulesVersion);
  } else {
    if (!latestRulesVersion?.includes("matcher")) {
      throw new Error(
        `Expected matcher rules, got rulesVersion=${latestRulesVersion ?? "(missing)"}`,
      );
    }
    console.log("OK matcher rules:", latestRulesVersion);
  }

  if (count < 1) {
    throw new Error(`Expected at least one eligibility row, got ${count}`);
  }

  if (MODE === "safe" && count !== course.expectedRows) {
    throw new Error(`Expected ${course.expectedRows} eligibility rows, got ${count}`);
  }

  if (MODE === "safe") {
    const feedbackBtn = page
      .getByRole("button", { name: "Doesn't match your documents?" })
      .first();
    if (await feedbackBtn.isVisible()) {
      await feedbackBtn.click();
      const feedbackForm = page.locator("fieldset").filter({ hasText: "What should this be?" }).first();
      await feedbackForm.getByRole("radio", { name: "Not met" }).click();
      await page.getByLabel("Add details (optional)").fill("Post-merge smoke override");
      await page.getByRole("button", { name: "Save feedback" }).click();
      await page
        .getByText(/Thanks — we've saved your feedback for admissions review/)
        .waitFor({ timeout: 15000 });
      console.log("OK override feedback submitted");
    }
  }

  console.log(`PASS ${MODE.toUpperCase()} course UI smoke`);
} catch (error) {
  console.error("FAIL", error);
  await page
    .screenshot({ path: path.join(REPO_ROOT, ".tmp/smoke-eligibility-error.png"), fullPage: true })
    .catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
