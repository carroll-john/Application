import { PostHog } from "posthog-node";

export const DEFAULT_POSTHOG_HOST = "https://eu.i.posthog.com";

export function normalizeHost(value: string | undefined) {
  const normalized = (value?.trim() || DEFAULT_POSTHOG_HOST).replace(/\/+$/, "");

  if (/^https:\/\/(eu|us|app)\.posthog\.com$/i.test(normalized)) {
    if (normalized.includes("eu.")) {
      return "https://eu.i.posthog.com";
    }
    return "https://us.i.posthog.com";
  }

  return normalized;
}

/** Ingestion host from the server env, falling back to the frontend's var. */
export function resolvePostHogHost() {
  return normalizeHost(
    process.env.POSTHOG_HOST?.trim() || process.env.VITE_POSTHOG_HOST?.trim(),
  );
}

export function resolvePostHogAppEnvironment() {
  return (
    process.env.APP_ENVIRONMENT?.trim() ||
    process.env.VITE_APP_ENVIRONMENT?.trim() ||
    process.env.VERCEL_ENV?.trim() ||
    process.env.NODE_ENV?.trim() ||
    "production"
  );
}

export function readApiKey() {
  return (
    process.env.POSTHOG_PROJECT_API_KEY?.trim() ||
    process.env.VITE_POSTHOG_KEY?.trim() ||
    ""
  );
}

/** FNV-1a — stable, dependency-free digest for building distinct ids. */
export function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function createTraceId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `trace-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Server events have no user session, so the distinct id is derived from the
 * course context. This means server events never join a person's funnel —
 * the client-side `eligibility_feedback_submitted` event exists to bridge
 * that gap (see src/lib/analytics/evidenceFlowAnalytics.ts).
 */
export function buildDistinctId(context: Record<string, unknown>) {
  const raw = JSON.stringify({
    courseCode:
      typeof context.courseCode === "string" ? context.courseCode.trim() : undefined,
    institution:
      typeof context.institution === "string" ? context.institution.trim() : undefined,
    level: typeof context.level === "string" ? context.level.trim() : undefined,
  });
  const digest = hashString(raw);
  return `eligibility-${digest}`;
}

let cachedClient: PostHog | null = null;

/**
 * Lazily construct a shared posthog-node client. Serverless containers reuse the
 * module across invocations, so the client is cached. Returns null when no API
 * key is configured.
 *
 * Callers in serverless handlers should use `captureImmediate()` (which sends
 * and resolves in one call) rather than the batched `capture()`, so events are
 * delivered before the function freezes/terminates.
 */
export function getPostHogServerClient(): PostHog | null {
  const apiKey = readApiKey();
  if (!apiKey) {
    return null;
  }

  if (!cachedClient) {
    cachedClient = new PostHog(apiKey, {
      host: resolvePostHogHost(),
      // Bound the request so a slow/unreachable PostHog can't add latency to the
      // user-facing feedback endpoint — `captureImmediate` awaits the HTTP
      // request, and the SDK default is 10s. This restores the ~1.2s ceiling the
      // previous raw fetch enforced via AbortController (one attempt, no retries).
      requestTimeout: 1500,
      fetchRetryCount: 0,
    });
  }

  return cachedClient;
}
