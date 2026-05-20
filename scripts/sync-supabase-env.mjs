#!/usr/bin/env node
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envLocalPath = resolve(rootDir, ".env.local");

function parseStatusEnv(output) {
  const values = {};

  for (const line of output.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)="([^"]*)"$/);
    if (!match) {
      continue;
    }

    values[match[1]] = match[2];
  }

  return values;
}

function upsertEnvLine(lines, key, value) {
  const prefix = `${key}=`;
  const nextLine = `${prefix}${value}`;
  const index = lines.findIndex((line) => line.startsWith(prefix));

  if (index === -1) {
    lines.push(nextLine);
    return;
  }

  lines[index] = nextLine;
}

let statusOutput = "";

try {
  statusOutput = execSync("supabase status -o env", {
    cwd: rootDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch (error) {
  const message =
    error instanceof Error ? error.message : "Unable to read Supabase status.";
  console.error(
    [
      "Could not sync Supabase env vars.",
      message,
      "Start the local stack with `supabase start`, or set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY manually.",
    ].join("\n"),
  );
  process.exit(1);
}

const status = parseStatusEnv(statusOutput);
const supabaseUrl = status.API_URL?.trim();
const supabaseAnonKey =
  status.PUBLISHABLE_KEY?.trim() || status.ANON_KEY?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Supabase status did not include API_URL and a publishable/anon key.",
  );
  process.exit(1);
}

const existing = existsSync(envLocalPath)
  ? readFileSync(envLocalPath, "utf8")
      .split("\n")
      .filter((line, index, lines) => line.length > 0 || index < lines.length - 1)
  : [];

upsertEnvLine(existing, "VITE_SUPABASE_URL", supabaseUrl);
upsertEnvLine(existing, "VITE_SUPABASE_ANON_KEY", supabaseAnonKey);

writeFileSync(`${envLocalPath}\n`, `${existing.join("\n").trimEnd()}\n`);

console.log(`Updated ${envLocalPath} with local Supabase auth settings.`);
