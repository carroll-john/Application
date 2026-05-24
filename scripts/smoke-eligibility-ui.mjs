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
  expectedRows: 3,
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

try {
  await page.goto(`${BASE}/sign-in?redirect=${encodeURIComponent("/overview")}`);
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.locator("form").getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/overview**", { timeout: 30000 });
  console.log("OK signed in ->", page.url());

  await page.goto(`${BASE}/courses/${course.slug}?apply=1&eligible=1`, {
    waitUntil: "networkidle",
  });

  const startFresh = page.getByRole("button", { name: "Start brand new application" });
  if (await startFresh.isVisible({ timeout: 10000 }).catch(() => false)) {
    await startFresh.click();
    await page.waitForURL("**/overview**", { timeout: 30000 });
  } else {
    await page.goto(`${BASE}/overview`, { waitUntil: "networkidle" });
  }

  await expectCourse(page, course.title);

  await page.goto(`${BASE}/section2/add-tertiary`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Add Tertiary Qualification" }).waitFor({
    timeout: 20000,
  });

  await page.getByPlaceholder("Start typing institution name").fill(
    "The University of Melbourne",
  );
  await page.getByRole("button", { name: "The University of Melbourne" }).click();
  await page.getByRole("combobox").nth(2).click();
  await page.getByRole("option", { name: "Bachelor Degree" }).click();
  await page.getByPlaceholder("e.g. Bachelor of Science").fill(
    "Bachelor of Information Technology",
  );

  await pickMonthYear(
    page.getByRole("button", { name: "Select month and year" }).first(),
    2020,
    "March",
  );
  await pickMonthYear(page.getByRole("button", { name: "Select month and year" }), 2024, "July");

  await page.locator('input[type="file"]').nth(0).setInputFiles(pdfPath);
  console.log("OK transcript file attached:", path.basename(pdfPath));

  await page.getByRole("button", { name: "Save & Continue" }).click();
  await page.waitForURL("**/section2/qualifications**", { timeout: 120000 });
  console.log("OK saved tertiary ->", page.url());

  await page.getByRole("heading", { name: "Transcript eligibility check" }).waitFor({
    timeout: 30000,
  });

  const rows = page.locator('[aria-label="Eligibility requirements"] li');
  const count = await rows.count();
  console.log("Eligibility rows:", count);

  if (MODE === "unsafe") {
    const bodyText = await page.locator("body").innerText();
    if (!bodyText.includes("deterministic")) {
      console.warn("WARN expected legacy deterministic copy in UI");
    }
  } else {
    const wrongBtn = page.getByRole("button", { name: "This check seems wrong" }).first();
    if (await wrongBtn.isVisible()) {
      await wrongBtn.click();
      await page.getByRole("radio", { name: "unknown" }).click();
      await page.getByLabel("Optional reason").fill("Smoke test override");
      await page.getByRole("button", { name: "Submit" }).click();
      await page
        .getByText("Thanks — your feedback has been recorded")
        .waitFor({ timeout: 10000 });
      console.log("OK override feedback submitted");
    }
  }

  if (count !== course.expectedRows) {
    throw new Error(`Expected ${course.expectedRows} eligibility rows, got ${count}`);
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
