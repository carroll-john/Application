#!/usr/bin/env node

const DEFAULT_APP_BASE_URL = "https://application-prototype.vercel.app";
const DEFAULT_ELIGIBILITY_HEALTH_URL =
  "https://eligibility-service-dqks.onrender.com/healthz";
const DEFAULT_SUGGEST_HEALTH_URL = "https://suggest-service-sm3b.onrender.com/healthz";
const DEFAULT_TIMEOUT_MS = 30000;

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function readTimeoutMs() {
  const value = Number.parseInt(process.env.SERVICE_HEALTH_TIMEOUT_MS ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TIMEOUT_MS;
}

function readTargets() {
  const appBaseUrl = trimTrailingSlash(
    process.env.APP_BASE_URL?.trim() ||
      process.env.SMOKE_BASE_URL?.trim() ||
      DEFAULT_APP_BASE_URL,
  );

  return [
    {
      name: "eligibility-service",
      url:
        process.env.ELIGIBILITY_SERVICE_HEALTH_URL?.trim() ||
        DEFAULT_ELIGIBILITY_HEALTH_URL,
      validate(payload) {
        return Boolean(
          payload &&
            payload.ok === true &&
            typeof payload.model === "string" &&
            payload.tokenProtected === true,
        );
      },
    },
    {
      name: "suggest-service",
      url: process.env.SUGGEST_SERVICE_HEALTH_URL?.trim() || DEFAULT_SUGGEST_HEALTH_URL,
      validate(payload) {
        return Boolean(
          payload &&
            payload.ok === true &&
            typeof payload.serviceVersion === "string" &&
            Number.isFinite(payload.institutionCount) &&
            payload.institutionCount > 0 &&
            typeof payload.addressLookupConfigured === "boolean",
        );
      },
    },
    {
      name: "application-suggest-proxy",
      url: `${appBaseUrl}/api/suggest/institutions?q=melb&country=AU&limit=1`,
      validate(payload) {
        return Array.isArray(payload?.suggestions) && payload.suggestions.length > 0;
      },
    },
  ];
}

async function checkTarget(target, timeoutMs) {
  const started = performance.now();

  try {
    const response = await fetch(target.url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const elapsedMs = Math.round(performance.now() - started);
    const payload = await response.json().catch(() => null);
    const valid = response.ok && target.validate(payload);

    return {
      elapsedMs,
      name: target.name,
      ok: valid,
      status: response.status,
    };
  } catch (error) {
    return {
      elapsedMs: Math.round(performance.now() - started),
      error: error instanceof Error ? error.message : String(error),
      name: target.name,
      ok: false,
      status: null,
    };
  }
}

async function main() {
  const timeoutMs = readTimeoutMs();
  const results = await Promise.all(
    readTargets().map((target) => checkTarget(target, timeoutMs)),
  );
  const ok = results.every((result) => result.ok);

  console.log(JSON.stringify({ ok, results }, null, 2));

  if (!ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
