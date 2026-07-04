import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ANALYTICS_EVENT_NAMES } from "./events";

const DOCS_PATH = resolve(__dirname, "../../../docs/analytics-events.md");
const CATALOG_START = "<!-- analytics-event-catalog:start -->";
const CATALOG_END = "<!-- analytics-event-catalog:end -->";

function readDocumentedEventNames(): string[] {
  const contents = readFileSync(DOCS_PATH, "utf8");
  const startIndex = contents.indexOf(CATALOG_START);
  const endIndex = contents.indexOf(CATALOG_END);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(
      `docs/analytics-events.md must contain the ${CATALOG_START} / ${CATALOG_END} markers around the event catalog table`,
    );
  }

  const section = contents.slice(startIndex + CATALOG_START.length, endIndex);
  return [...section.matchAll(/`(\$?[a-z0-9_]+)`/g)].map((match) => match[1]);
}

describe("analytics event catalog", () => {
  it("contains no duplicate event names", () => {
    expect(new Set(ANALYTICS_EVENT_NAMES).size).toBe(ANALYTICS_EVENT_NAMES.length);
  });

  it("uses snake_case for all app event names", () => {
    for (const name of ANALYTICS_EVENT_NAMES) {
      if (name.startsWith("$")) {
        continue; // PostHog reserved events keep their $ prefix.
      }
      expect(name, `event name "${name}" must be snake_case`).toMatch(
        /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/,
      );
    }
  });

  it("matches the event catalog documented in docs/analytics-events.md", () => {
    const documented = readDocumentedEventNames();

    expect(new Set(documented).size, "docs list each event once").toBe(
      documented.length,
    );

    const documentedSet = new Set(documented);
    const catalogSet = new Set<string>(ANALYTICS_EVENT_NAMES);

    const missingFromDocs = [...catalogSet].filter((name) => !documentedSet.has(name));
    const missingFromCatalog = [...documentedSet].filter(
      (name) => !catalogSet.has(name),
    );

    expect(missingFromDocs, "events missing from docs/analytics-events.md").toEqual([]);
    expect(
      missingFromCatalog,
      "documented events missing from src/lib/analytics/events.ts (client events only — server events live in their own docs section)",
    ).toEqual([]);
  });
});
