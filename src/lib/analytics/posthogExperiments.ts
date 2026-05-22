import { canCapturePostHog, initPostHog } from "./posthogClient";
import {
  CV_PARSER_FEATURE_FLAG_KEY,
  ENABLED_VARIANTS,
  type AiExperimentState,
  type CvParserExperimentState,
} from "./posthogTypes";

function normalizeFeatureFlagVariant(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  return ENABLED_VARIANTS.has(value.trim().toLowerCase());
}

export function getAiExperimentState(flagKey: string): AiExperimentState {
  if (!canCapturePostHog()) {
    return {
      enabled: true,
      source: "fallback",
      variant: null,
    };
  }

  initPostHog();

  const variant = window.posthog?.getFeatureFlag?.(flagKey);
  const normalizedVariant = normalizeFeatureFlagVariant(variant);
  const safeVariant =
    typeof variant === "string" || typeof variant === "boolean" ? variant : null;

  if (normalizedVariant !== null) {
    return {
      enabled: normalizedVariant,
      source: "posthog",
      variant: safeVariant,
    };
  }

  const enabled = window.posthog?.isFeatureEnabled?.(flagKey);

  if (typeof enabled === "boolean") {
    return {
      enabled,
      source: "posthog",
      variant: safeVariant ?? enabled,
    };
  }

  return {
    enabled: true,
    source: "fallback",
    variant: safeVariant,
  };
}

export function getCvParserExperimentState(): CvParserExperimentState {
  return getAiExperimentState(CV_PARSER_FEATURE_FLAG_KEY);
}
