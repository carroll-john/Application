import { useFeatureFlagEnabled } from "posthog-js/react";
import type { FeatureFlagKey } from "../lib/analytics/featureFlags";

// Typed wrapper over posthog-js/react's flag hook. Treats "not yet loaded"
// (undefined) as false so flag-gated UI renders the control/default variant
// without layout shift until flags resolve. Requires <PostHogProvider> (App.tsx).
export function useFeatureFlag(key: FeatureFlagKey): boolean {
  return useFeatureFlagEnabled(key) ?? false;
}
