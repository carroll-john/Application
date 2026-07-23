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
      const result = await page.evaluate(() => {
        const isVisible = (element) => element.getClientRects().length > 0;
        const radius = (element) =>
          Number.parseFloat(window.getComputedStyle(element).borderTopLeftRadius);
        const contentBlocks = [...document.querySelectorAll(".content-block, .content-block-compact")]
          .filter(isVisible);
        const controls = [
          ...document.querySelectorAll(
            'button:not(.content-block), input:not([type="checkbox"]):not([type="radio"]), textarea, select',
          ),
        ].filter(isVisible);
        const ucCourseImages = [
          ...document.querySelectorAll('img[src^="/content/dam/uc/"]'),
        ];
        return {
          brokenUcCourseImages: ucCourseImages.filter(
            (image) => !image.complete || image.naturalWidth === 0,
          ).length,
          hasKeypathTechServiceMark: Boolean(
            document.querySelector("[data-keypath-tech-service-mark]"),
          ),
          hasStudyNext: /studynext/i.test(document.body.innerText),
          hasUcLogo: Boolean(document.querySelector('img[alt="University of Canberra"]')),
          courseSearchPlaceholder: document
            .querySelector('input[aria-label="Search courses"]')
            ?.getAttribute("placeholder"),
          nonSquareContentBlocks: contentBlocks.filter((element) => radius(element) !== 0).length,
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          squareControls: controls.filter((element) => radius(element) === 0).length,
          title: document.title,
          ucCourseImageCount: ucCourseImages.length,
          uniqueUcCourseImageCount: new Set(
            ucCourseImages.map((image) => image.currentSrc || image.src),
          ).size,
        };
      });

      if (result.hasStudyNext) failures.push(`${viewport.name} ${route}: StudyNext visible`);
      if (!result.hasUcLogo) failures.push(`${viewport.name} ${route}: UC logo missing`);
      if (route === "/" && result.courseSearchPlaceholder !== "Search courses") {
        failures.push(
          `${viewport.name} ${route}: unexpected course search placeholder`,
        );
      }
      if (result.hasKeypathTechServiceMark) {
        failures.push(`${viewport.name} ${route}: Keypath service mark present`);
      }
      if (result.nonSquareContentBlocks > 0) {
        failures.push(
          `${viewport.name} ${route}: ${result.nonSquareContentBlocks} content blocks are rounded`,
        );
      }
      if (result.overflow) failures.push(`${viewport.name} ${route}: horizontal overflow`);
      if (result.squareControls > 0) {
        failures.push(`${viewport.name} ${route}: ${result.squareControls} controls are square`);
      }
      if (result.title !== "Applications | University of Canberra") {
        failures.push(`${viewport.name} ${route}: unexpected title ${result.title}`);
      }
      if (route === "/" && result.ucCourseImageCount === 0) {
        failures.push(`${viewport.name} ${route}: UC course imagery missing`);
      }
      if (route === "/" && result.brokenUcCourseImages > 0) {
        failures.push(
          `${viewport.name} ${route}: ${result.brokenUcCourseImages} UC course images failed`,
        );
      }
      if (route === "/" && result.uniqueUcCourseImageCount < 20) {
        failures.push(
          `${viewport.name} ${route}: only ${result.uniqueUcCourseImageCount} unique UC course images`,
        );
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

      if (route === "/") {
        const parserRoute = "**/api/parse-cv?flow=uc-pre-application";
        const consoleErrorCountBeforeFlow = consoleErrors.length;
        await page.route(parserRoute, async (requestRoute) => {
          await new Promise((resolve) => setTimeout(resolve, 750));
          await requestRoute.fulfill({
            body: JSON.stringify({
              applicant: {},
              experiences: [
                {
                  company: "University of Canberra",
                  currentRole: true,
                  duties: "Led education programs and strategic projects.",
                  oscaConfidence: "high",
                  oscaOccupationCode: "131134",
                  oscaOccupationTitle: "Project Manager",
                  oscaRationale: "The role leads complex programs and projects.",
                  oscaSkillLevel: 1,
                  position: "Program Manager",
                  startMonth: "January",
                  startYear: "2020",
                  type: "Full-time",
                },
              ],
              professionalAccreditations: [],
              secondaryQualifications: [],
              tertiaryQualifications: [],
            }),
            contentType: "application/json",
            status: 200,
          });
        });

        try {
          await page.locator('input[type="file"]').setInputFiles({
            buffer: Buffer.from("UC CV assessment smoke fixture"),
            mimeType: "text/plain",
            name: "uc-assessment-smoke.txt",
          });

          for (const heading of [
            "Reviewing your CV",
            "Review your experience",
          ]) {
            await page.getByRole("heading", { name: heading }).waitFor();
            if (
              await page
                .getByRole("heading", { name: "Explore postgraduate courses" })
                .isVisible()
            ) {
              failures.push(
                `${viewport.name} ${route}: course catalogue visible on ${heading}`,
              );
            }
          }

          await page.getByRole("button", { name: "Find my course matches" }).click();
          const matchesHeading = "Courses matched to your experience";
          await page.getByRole("heading", { name: matchesHeading }).waitFor();
          if (
            await page
              .getByRole("heading", { name: "Explore postgraduate courses" })
              .isVisible()
          ) {
            failures.push(
              `${viewport.name} ${route}: course catalogue visible on ${matchesHeading}`,
            );
          }
        } finally {
          await page.unroute(parserRoute);
        }

        if (consoleErrors.length > consoleErrorCountBeforeFlow) {
          failures.push(
            `${viewport.name} ${route}: ${consoleErrors.length - consoleErrorCountBeforeFlow} console errors in CV assessment flow`,
          );
        }
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
