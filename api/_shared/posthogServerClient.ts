import { PostHog } from "posthog-node";

const DEFAULT_POSTHOG_HOST = "https://eu.i.posthog.com";

function normalizeHost(value: string | undefined) {
  const normalized = (value?.trim() || DEFAULT_POSTHOG_HOST).replace(/\/+$/, "");

  if (/^https:\/\/(eu|us|app)\.posthog\.com$/i.test(normalized)) {
    if (normalized.includes("eu.")) {
      return "https://eu.i.posthog.com";
    }
    return "https://us.i.posthog.com";
  }

  return normalized;
}

function readApiKey() {
  return (
    process.env.POSTHOG_PROJECT_API_KEY?.trim() ||
    process.env.VITE_POSTHOG_KEY?.trim() ||
    ""
  );
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
      host: normalizeHost(
        process.env.POSTHOG_HOST?.trim() || process.env.VITE_POSTHOG_HOST?.trim(),
      ),
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
