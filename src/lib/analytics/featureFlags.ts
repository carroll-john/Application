import posthog from "posthog-js";
import { canCapturePostHog, initPostHog } from "./posthogClient";

// Known PostHog feature-flag keys. Keep this union in sync with the flags
// defined in the PostHog project so flag reads are typed instead of stringly
// typed. (These are examples/scaffolding — replace with the real flag keys.)
export type FeatureFlagKey = "cv_parser_v2" | "transcript_parser_v2";

// Imperative (non-React) flag read, gated the same way as the rest of analytics.
// Returns false when capture is disabled. Like the React hook, this reflects the
// flag value cached by posthog-js, which for returning users may briefly be stale
// until the fresh /flags response arrives — gate freshness-sensitive flags on
// posthog.onFeatureFlags rather than this value alone.
export function isFeatureFlagEnabled(key: FeatureFlagKey): boolean {
  if (!canCapturePostHog()) {
    return false;
  }

  initPostHog();
  return posthog.isFeatureEnabled(key) ?? false;
}

// Imperative read of a flag's JSON payload (for multivariate / config flags).
export function getFeatureFlagPayload(key: FeatureFlagKey): unknown {
  if (!canCapturePostHog()) {
    return undefined;
  }

  initPostHog();
  return posthog.getFeatureFlagPayload(key);
}
