#!/usr/bin/env node
/**
 * Catches Node ESM resolution failures (e.g. ERR_MODULE_NOT_FOUND from
 * extensionless relative imports) in api/* function entrypoints BEFORE they
 * ship to Vercel.
 *
 * Vitest and `tsc -b` both use bundler-style resolution and silently accept
 * extensionless relative imports inside src/lib/, but Vercel's serverless
 * runtime is plain Node ESM and rejects them at module init — the function
 * then dies with FUNCTION_INVOCATION_FAILED for every request (see PR #79).
 *
 * Strategy:
 *   1. Compile api/ + src/lib/ to .api-runtime-check/ via tsc, preserving
 *      import specifiers verbatim.
 *   2. Drop a `package.json` with `"type": "module"` next to the output so
 *      Node treats each .js file as ESM.
 *   3. Dynamically `import()` each api/<entrypoint>.js. If module init throws
 *      ERR_MODULE_NOT_FOUND we fail loudly with a useful pointer.
 *
 * We intentionally only exercise module initialisation; handler functions
 * are never invoked, so no env vars or network are required.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");
const outDir = resolve(repoRoot, ".api-runtime-check");
const tsconfigPath = resolve(repoRoot, "tsconfig.api-runtime.json");

function log(level, message) {
  const prefix = level === "error" ? "[check-api-esm] ERROR" : "[check-api-esm]";
  const stream = level === "error" ? process.stderr : process.stdout;
  stream.write(`${prefix} ${message}\n`);
}

function runTypeScriptCompile() {
  log("info", `compiling api/ + src/lib/ to ${relative(repoRoot, outDir)}/ ...`);
  rmSync(outDir, { recursive: true, force: true });
  const result = spawnSync(
    process.execPath,
    [resolve(repoRoot, "node_modules/typescript/lib/tsc.js"), "-p", tsconfigPath],
    { cwd: repoRoot, stdio: "inherit" },
  );
  if (result.status !== 0) {
    log("error", "tsc compile failed.");
    process.exit(result.status ?? 1);
  }
  writeFileSync(
    join(outDir, "package.json"),
    `${JSON.stringify({ type: "module" }, null, 2)}\n`,
  );
}

function listApiEntryFiles() {
  const apiOutDir = join(outDir, "api");
  if (!existsSync(apiOutDir)) {
    log("error", `expected compiled output at ${relative(repoRoot, apiOutDir)}.`);
    process.exit(1);
  }
  return readdirSync(apiOutDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.endsWith(".js"))
    .filter((name) => !name.endsWith(".test.js") && !name.endsWith(".spec.js"))
    .map((name) => join(apiOutDir, name));
}

async function importOne(filePath) {
  const relPath = relative(repoRoot, filePath);
  try {
    await import(pathToFileURL(filePath).href);
    log("info", `OK   ${relPath}`);
    return true;
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? err.code : null;
    log("error", `FAIL ${relPath} (${code ?? err?.name ?? "unknown"})`);
    if (code === "ERR_MODULE_NOT_FOUND") {
      log(
        "error",
        "  This usually means a relative import in src/lib/ is missing a `.js`" +
          " extension. Vercel's Node ESM runtime requires explicit extensions on" +
          " relative imports — see PR #79 for the matcher fix.",
      );
    }
    log("error", `  ${err?.stack ?? err}`);
    return false;
  }
}

async function main() {
  runTypeScriptCompile();
  const entries = listApiEntryFiles();
  if (entries.length === 0) {
    log("error", "no api/ entry files found after compile.");
    process.exit(1);
  }
  log("info", `loading ${entries.length} api entrypoint(s) under Node ESM...`);
  let allOk = true;
  for (const file of entries) {
    const ok = await importOne(file);
    if (!ok) allOk = false;
  }
  if (!allOk) {
    log("error", "one or more api/ entrypoints failed to initialise under Node ESM.");
    process.exit(1);
  }
  log("info", `all ${entries.length} api/ entrypoints loaded cleanly.`);
}

main().catch((err) => {
  log("error", `unexpected failure: ${err?.stack ?? err}`);
  process.exit(1);
});
