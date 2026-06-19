import { useFeatureFlagEnabled } from "posthog-js/react";
import type { FeatureFlagKey } from "../lib/analytics/featureFlags";

// Typed wrapper over posthog-js/react's flag hook.
//
// First-time users: the flag is `undefined` until the /flags response arrives,
// which this treats as `false` (renders the control/default variant, no flicker).
//
// Returning users: posthog-js persists flags in localStorage, so the cached value
// is returned immediately and may briefly be stale until the fresh /flags response
// replaces it. That is the intended default (instant, no flicker). For kill-switch
// or freshness-sensitive flags, gate rendering on a flags-loaded signal
// (`posthog.onFeatureFlags`) rather than relying on this hook alone.
//
// Requires <PostHogProvider> (App.tsx).
export function useFeatureFlag(key: FeatureFlagKey): boolean {
  return useFeatureFlagEnabled(key) ?? false;
}
