import { createHash } from "node:crypto";

const ANALYTICS_HASH_SALT =
  process.env.VITE_ANALYTICS_HASH_SALT?.trim() ||
  process.env.ANALYTICS_HASH_SALT?.trim() ||
  "application-prototype";

function normalizeIdentifier(rawIdentifier: string) {
  const normalizedIdentifier = rawIdentifier.trim().toLowerCase();

  if (!normalizedIdentifier) {
    return null;
  }

  return `${ANALYTICS_HASH_SALT}:${normalizedIdentifier}`;
}

/**
 * Server-side analytics distinct id for Supabase user ids. Mirrors the browser
 * `hashAnalyticsIdentifier` path (SHA-256) so server events join the same person
 * as client-side `posthog.identify`.
 */
export function hashAnalyticsIdentifierServer(rawIdentifier: string) {
  const hashInput = normalizeIdentifier(rawIdentifier);
  if (!hashInput) {
    return "anonymous";
  }

  const digest = createHash("sha256").update(hashInput).digest("hex");
  return `sha256:${digest}`;
}
