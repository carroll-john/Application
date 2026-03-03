import posthog from "posthog-js";

const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";
const ENABLED_VARIANTS = new Set([
  "enabled",
  "on",
  "true",
  "test",
  "treatment",
  "variant",
  "variant_a",
  "variant_b",
]);

type EventProperties = Record<string, string | number | boolean | null | undefined>;

const posthogKey = import.meta.env.VITE_POSTHOG_KEY?.trim();
const posthogHost = import.meta.env.VITE_POSTHOG_HOST?.trim() || DEFAULT_POSTHOG_HOST;

export const CV_PARSER_FEATURE_FLAG_KEY =
  import.meta.env.VITE_POSTHOG_CV_PARSER_FLAG?.trim() ||
  "cv_parser_autofill_experiment";
export const isPostHogEnabled = Boolean(posthogKey);

let isPostHogInitialized = false;

export interface CvParserExperimentState {
  enabled: boolean;
  source: "posthog" | "fallback";
  variant: string | boolean | null;
}

function normalizeFeatureFlagVariant(value: string | boolean | undefined) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  return ENABLED_VARIANTS.has(value.trim().toLowerCase());
}

export function initPostHog() {
  if (!isPostHogEnabled || isPostHogInitialized) {
    return;
  }

  posthog.init(posthogKey!, {
    api_host: posthogHost,
    capture_pageview: false,
    person_profiles: "identified_only",
  });

  isPostHogInitialized = true;
}

export function identifyPostHogUser(
  distinctId: string,
  properties?: EventProperties,
) {
  if (!isPostHogEnabled || !isPostHogInitialized || !distinctId) {
    return;
  }

  posthog.identify(distinctId, properties);
  posthog.reloadFeatureFlags();
}

export function resetPostHogUser() {
  if (!isPostHogEnabled || !isPostHogInitialized) {
    return;
  }

  posthog.reset();
}

export function onPostHogFeatureFlags(callback: () => void) {
  if (!isPostHogEnabled || !isPostHogInitialized) {
    return () => {};
  }

  return posthog.onFeatureFlags(callback);
}

export function capturePostHogEvent(
  eventName: string,
  properties?: EventProperties,
) {
  if (!isPostHogEnabled || !isPostHogInitialized) {
    return;
  }

  posthog.capture(eventName, properties);
}

export function getCvParserExperimentState(): CvParserExperimentState {
  if (!isPostHogEnabled || !isPostHogInitialized) {
    return {
      enabled: true,
      source: "fallback",
      variant: null,
    };
  }

  const variant = posthog.getFeatureFlag(CV_PARSER_FEATURE_FLAG_KEY) as
    | string
    | boolean
    | undefined;
  const normalizedVariant = normalizeFeatureFlagVariant(variant);

  if (normalizedVariant !== null) {
    return {
      enabled: normalizedVariant,
      source: "posthog",
      variant: variant ?? null,
    };
  }

  const enabled = posthog.isFeatureEnabled(CV_PARSER_FEATURE_FLAG_KEY);

  if (typeof enabled === "boolean") {
    return {
      enabled,
      source: "posthog",
      variant: variant ?? enabled,
    };
  }

  return {
    enabled: true,
    source: "fallback",
    variant: variant ?? null,
  };
}
