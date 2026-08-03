import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const baseUrl = process.env.APP_BASE_URL?.trim() || "http://127.0.0.1:4173";
const routes = ["/", "/assessment", "/staff/reviews"];
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];
const failures = [];
const browser = await chromium.launch({ headless: true });

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    for (const route of routes) {
      await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      for (const violation of results.violations) {
        const examples = violation.nodes
          .slice(0, 5)
          .map((node) => `${node.target.join(" ")} (${node.failureSummary ?? ""})`)
          .join("; ");
        failures.push(
          `${viewport.name} ${route}: ${violation.id} (${violation.impact ?? "unknown"}) ` +
            `${violation.nodes.length} node(s) — ${violation.help}; ${examples}`,
        );
      }

      const layout = await page.evaluate(() => ({
        hasHorizontalOverflow:
          document.documentElement.scrollWidth > document.documentElement.clientWidth,
        mainCount: document.querySelectorAll("main").length,
      }));
      if (layout.hasHorizontalOverflow) {
        failures.push(`${viewport.name} ${route}: horizontal overflow`);
      }
      if (layout.mainCount !== 1) {
        failures.push(`${viewport.name} ${route}: expected one main landmark`);
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}

if (failures.length > 0) {
  process.stderr.write(`Accessibility smoke failed:\n- ${failures.join("\n- ")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Accessibility smoke passed for ${routes.length} routes at desktop and mobile sizes.\n`,
  );
}
