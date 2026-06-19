#!/usr/bin/env tsx
/**
 * Pulls every `eligibility_check_override` event from PostHog and writes a labelled corpus JSON
 * file. Admissions team overrides become labelled examples that we can use to:
 *   - Spot-check matcher behaviour against real disagreements
 *   - Compose new entries in matcherFixtures.ts
 *   - Tune the parser prompt when overrides cluster on specific requirement kinds
 *
 * Auth:
 *   POSTHOG_PERSONAL_API_KEY  required (starts with `phx_…`). Project keys do NOT work for queries.
 *   POSTHOG_PROJECT_ID        required (the numeric project id).
 *   POSTHOG_HOST              optional (defaults to https://eu.i.posthog.com). US users: https://us.i.posthog.com.
 *
 * Usage:
 *   POSTHOG_PERSONAL_API_KEY=phx_… POSTHOG_PROJECT_ID=12345 \
 *     tsx scripts/dump-eligibility-overrides.ts
 *
 *   # Limit to last 14 days, write to a custom file:
 *   tsx scripts/dump-eligibility-overrides.ts --since=14d --out=data/eligibility-overrides.json
 *
 *   # Dry-run (print the HogQL query and exit):
 *   tsx scripts/dump-eligibility-overrides.ts --dry
 */

import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = resolve(__filename, "../..");

const DEFAULT_OUT = resolve(repoRoot, "data/eligibility-overrides.json");
const DEFAULT_SINCE = "90d";
const DEFAULT_HOST = "https://eu.i.posthog.com";

interface Flags {
  since: string;
  out: string;
  dry: boolean;
  host: string;
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { since: DEFAULT_SINCE, out: DEFAULT_OUT, dry: false, host: DEFAULT_HOST };
  for (const arg of argv.slice(2)) {
    if (arg === "--dry") flags.dry = true;
    else if (arg.startsWith("--since=")) flags.since = arg.slice("--since=".length);
    else if (arg.startsWith("--out=")) flags.out = resolve(repoRoot, arg.slice("--out=".length));
    else if (arg.startsWith("--host=")) flags.host = arg.slice("--host=".length);
  }
  return flags;
}

const SINCE_UNIT_MAP: Record<string, string> = {
  s: "SECOND",
  m: "MINUTE",
  h: "HOUR",
  d: "DAY",
  w: "WEEK",
};

function parseSinceToHogQL(since: string): string {
  // PostHog HogQL uses `INTERVAL <count> <unit>` (e.g. `INTERVAL 90 DAY`), not the standard SQL
  // `INTERVAL '90 days'`. Convert shorthand like `14d`, `6h`, `90d` to the right shape.
  const match = since.trim().match(/^(\d+)\s*([smhdw])$/i);
  if (!match) {
    throw new Error(
      `Invalid --since value "${since}". Use e.g. 14d, 6h, 30d, 2w. Allowed units: s, m, h, d, w.`,
    );
  }
  const count = match[1];
  const unit = SINCE_UNIT_MAP[match[2].toLowerCase()];
  return `INTERVAL ${count} ${unit}`;
}

function buildHogQL(since: string): string {
  const interval = parseSinceToHogQL(since);
  return `
    SELECT
      timestamp,
      properties.course_code AS course_code,
      properties.course_title AS course_title,
      properties.requirement_id AS requirement_id,
      properties.requirement_source_text AS requirement_source_text,
      properties.original_status AS original_status,
      properties.override_status AS override_status,
      properties.reason AS reason,
      properties.eligibility_rules_version AS rules_version,
      properties.eligibility_service_version AS service_version,
      distinct_id
    FROM events
    WHERE event = 'eligibility_check_override'
      AND timestamp >= now() - ${interval}
    ORDER BY timestamp DESC
    LIMIT 5000
  `.trim();
}

async function runHogQL(host: string, projectId: string, apiKey: string, query: string) {
  const url = `${host.replace(/\/+$/, "")}/api/projects/${encodeURIComponent(projectId)}/query/`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      query: {
        kind: "HogQLQuery",
        query,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "(no body)");
    throw new Error(
      `PostHog query failed (${response.status}): ${body.slice(0, 600)}\nURL: ${url}`,
    );
  }

  return (await response.json()) as {
    columns?: string[];
    results?: unknown[][];
    types?: string[];
  };
}

async function main() {
  const flags = parseFlags(process.argv);
  const query = buildHogQL(flags.since);

  if (flags.dry) {
    console.log(`Query (since=${flags.since}):\n`);
    console.log(query);
    return;
  }

  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY?.trim();
  const projectId = process.env.POSTHOG_PROJECT_ID?.trim();
  const host = process.env.POSTHOG_HOST?.trim() || flags.host;

  if (!apiKey) {
    throw new Error(
      "POSTHOG_PERSONAL_API_KEY is not set. Create a personal API key at /settings/user-api-keys with `query:read` scope.",
    );
  }
  if (!projectId) {
    throw new Error("POSTHOG_PROJECT_ID is not set.");
  }

  const result = await runHogQL(host, projectId, apiKey, query);
  const columns = result.columns ?? [];
  const rows = result.results ?? [];

  const corpus = rows.map((row) => {
    const record: Record<string, unknown> = {};
    columns.forEach((column, index) => {
      record[column] = row[index];
    });
    return record;
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    host,
    projectId,
    since: flags.since,
    eventCount: corpus.length,
    events: corpus,
  };

  await writeFile(flags.out, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  // Helpful counts so the operator can eyeball the corpus quality.
  const byTransition = new Map<string, number>();
  for (const record of corpus) {
    const key = `${String(record.original_status ?? "?")} → ${String(record.override_status ?? "?")}`;
    byTransition.set(key, (byTransition.get(key) ?? 0) + 1);
  }

  console.log(`Wrote ${corpus.length} override events to ${flags.out}`);
  if (corpus.length > 0) {
    console.log("\nTop status transitions:");
    [...byTransition.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([transition, count]) => {
        console.log(`  ${transition.padEnd(30)} ${count}`);
      });
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
