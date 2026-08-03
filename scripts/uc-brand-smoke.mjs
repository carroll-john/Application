import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import rawUcCatalog from "../src/data/courses.uc.raw.json" with { type: "json" };

const baseUrl = process.env.UC_DEMO_BASE_URL ?? "http://127.0.0.1:5173";
const outputDirectory = "output/playwright/uc-pilot-brand";
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
const assessmentRoute = "/assessment?invite=uc-smoke-treatment-invitation-token";
const routes = ["/", assessmentRoute, "/sign-in", ...courseRoutes];

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const failures = [];

async function verifyExperienceSummary(page, viewportName, route, stateName) {
  const summaryRail = await page.evaluate(() => {
    const rail = document.querySelector('[aria-label="Experience summary"]');
    if (!rail) return null;

    const children = [...rail.children];
    return {
      backgroundColors: children.map(
        (child) => window.getComputedStyle(child).backgroundColor,
      ),
      labels: children.map((child) => child.textContent?.trim() ?? ""),
      tagNames: children.map((child) => child.tagName),
    };
  });
  const prefix = `${viewportName} ${route} ${stateName}`;

  if (!summaryRail) {
    failures.push(`${prefix}: experience summary rail missing`);
    return;
  }

  const [roleCount, duration, roleLevel, entryGuidance, edit] =
    summaryRail.labels;
  if (roleCount !== "1 role from CV") {
    failures.push(`${prefix}: role count is not first`);
  }
  if (!/years? experience$|months? experience$/.test(duration ?? "")) {
    failures.push(`${prefix}: experience duration is not second`);
  }
  if (roleLevel !== "Senior or highly specialised roles") {
    failures.push(`${prefix}: role level is not third`);
  }
  if (entryGuidance !== "May be eligible for direct entry") {
    failures.push(`${prefix}: entry guidance is not fourth`);
  }
  if (edit !== "Edit" || summaryRail.tagNames[4] !== "BUTTON") {
    failures.push(`${prefix}: Edit is not the final action`);
  }
  if (summaryRail.backgroundColors[3] === summaryRail.backgroundColors[2]) {
    failures.push(`${prefix}: entry guidance is not visually prominent`);
  }
  if (summaryRail.backgroundColors[4] === summaryRail.backgroundColors[3]) {
    failures.push(`${prefix}: Edit is not visually prominent`);
  }

  await page.locator('[aria-label="Experience summary"]').screenshot({
    path: `${outputDirectory}/${viewportName}-${stateName}-experience-summary.png`,
  });
}

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    await page.route("**/api/assessment/activate", async (requestRoute) => {
      await requestRoute.fulfill({
        body: JSON.stringify({
          cohort: "treatment",
          participantId: "00000000-0000-4000-8000-000000000001",
          partnerId: "university-of-canberra",
          resumed: false,
          sessionId: null,
        }),
        contentType: "application/json",
        status: 200,
      });
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
        const studyNextHeader = document.querySelector("[data-studynext-brand-header]");
        const ucFooter = document.querySelector("[data-uc-brand-footer]");
        const rootStyles = window.getComputedStyle(document.documentElement);
        return {
          bodyFontFamily: window.getComputedStyle(document.body).fontFamily,
          brandNavy: rootStyles.getPropertyValue("--sn-navy").trim(),
          brandMint: rootStyles.getPropertyValue("--sn-mint").trim(),
          brandYellow: rootStyles.getPropertyValue("--sn-yellow").trim(),
          hasKeypathTechServiceMark: Boolean(
            document.querySelector("[data-keypath-tech-service-mark]"),
          ),
          hasStudyNext: /studynext/i.test(
            document.body.innerText.replace(/\s+/g, ""),
          ),
          hasUcFooter: Boolean(ucFooter),
          hasStudyNextHeader: Boolean(studyNextHeader),
          hasUcHeader: Boolean(document.querySelector("[data-uc-brand-header]")),
          hasUcLogo: Boolean(document.querySelector('img[alt="University of Canberra"]')),
          courseSearchPlaceholder: document
            .querySelector('input[aria-label="Search courses"]')
            ?.getAttribute("placeholder"),
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          squareContentBlocks: contentBlocks.filter((element) => radius(element) === 0).length,
          squareControls: controls.filter((element) => radius(element) === 0).length,
          title: document.title,
        };
      });

      if (result.hasStudyNext) failures.push(`${viewport.name} ${route}: StudyNext branding present`);
      if (result.hasStudyNextHeader) failures.push(`${viewport.name} ${route}: StudyNext header present`);
      if (!result.hasUcHeader) failures.push(`${viewport.name} ${route}: UC header missing`);
      if (!result.hasUcLogo) failures.push(`${viewport.name} ${route}: UC logo missing`);
      if (result.hasUcFooter) failures.push(`${viewport.name} ${route}: UC footer still present`);
      if (!result.bodyFontFamily.toLowerCase().includes("montserrat")) {
        failures.push(`${viewport.name} ${route}: Montserrat is not the active font`);
      }
      if (result.brandNavy !== "#414d61") {
        failures.push(`${viewport.name} ${route}: unexpected UC navy ${result.brandNavy}`);
      }
      if (result.brandMint !== "#92d6e3") {
        failures.push(`${viewport.name} ${route}: unexpected UC blue ${result.brandMint}`);
      }
      if (result.brandYellow !== "#ffcc32") {
        failures.push(`${viewport.name} ${route}: unexpected UC yellow ${result.brandYellow}`);
      }
      if (result.hasKeypathTechServiceMark) {
        failures.push(`${viewport.name} ${route}: Keypath service mark present`);
      }
      if (result.overflow) failures.push(`${viewport.name} ${route}: horizontal overflow`);
      if (result.squareControls > 0) {
        failures.push(`${viewport.name} ${route}: ${result.squareControls} controls are square`);
      }
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
        if (route === "/") {
          await page.locator("[data-uc-brand-header]").screenshot({
            path: `${outputDirectory}/${viewport.name}-header.png`,
          });
        }
      }

      if (route === assessmentRoute) {
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
                .getByRole("heading", { name: "All courses" })
                .isVisible()
            ) {
              failures.push(
                `${viewport.name} ${route}: course catalogue visible on ${heading}`,
              );
            }
          }

          await verifyExperienceSummary(
            page,
            viewport.name,
            route,
            "review",
          );

          await page.getByRole("button", { name: "Find my course matches" }).click();
          const matchesHeading = "Courses matched to your experience";
          await page.getByRole("heading", { name: matchesHeading }).waitFor();
          if (
            await page
              .getByRole("heading", { name: "All courses" })
              .isVisible()
          ) {
            failures.push(
              `${viewport.name} ${route}: course catalogue visible on ${matchesHeading}`,
            );
          }

          await verifyExperienceSummary(
            page,
            viewport.name,
            route,
            "results",
          );
          await page.getByRole("button", { name: "Edit" }).click();
          await page
            .getByRole("heading", { name: "Review your experience" })
            .waitFor();
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

console.log(`UC pilot brand smoke passed across ${routes.length} routes and ${viewports.length} viewports.`);
