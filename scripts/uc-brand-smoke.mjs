import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import rawUcCatalog from "../src/data/courses.uc.raw.json" with { type: "json" };

const baseUrl = process.env.UC_DEMO_BASE_URL ?? "http://127.0.0.1:5173";
const outputDirectory = "output/playwright/uc-brand";
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const courseRoutes = rawUcCatalog.courses.map(
  (course) => `/courses/${slugify(course.course_name)}`,
);
const routes = ["/", "/sign-in", ...courseRoutes];

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const failures = [];

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    for (const route of routes) {
      consoleErrors.length = 0;
      await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
      const result = await page.evaluate(() => ({
        hasStudyNext: document.body.innerText.includes("StudyNext"),
        hasUcLogo: Boolean(document.querySelector('img[alt="University of Canberra"]')),
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        title: document.title,
      }));

      if (result.hasStudyNext) failures.push(`${viewport.name} ${route}: StudyNext visible`);
      if (!result.hasUcLogo) failures.push(`${viewport.name} ${route}: UC logo missing`);
      if (result.overflow) failures.push(`${viewport.name} ${route}: horizontal overflow`);
      if (result.title !== "Applications | University of Canberra") {
        failures.push(`${viewport.name} ${route}: unexpected title ${result.title}`);
      }
      if (consoleErrors.length > 0) {
        failures.push(`${viewport.name} ${route}: ${consoleErrors.length} console errors`);
      }

      if (route === "/" || route.includes("master-of-business-administration-government")) {
        const routeName = route === "/" ? "catalogue" : "mba-government";
        await page.screenshot({
          path: `${outputDirectory}/${viewport.name}-${routeName}.png`,
          fullPage: true,
        });
      }
    }

    await page.close();
  }
} finally {
  await browser.close();
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`UC brand smoke passed across ${routes.length} routes and ${viewports.length} viewports.`);
