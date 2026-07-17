import * as Sentry from "@sentry/react";
import { useEffect } from "react";
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from "react-router-dom";
import posthog from "posthog-js";
import { hashAnalyticsIdentifierSync } from "./analyticsIdentity";
import { isPostHogEnabled } from "./posthog";

type SentryUserContext = {
  email?: string;
  emailDomain?: string;
  id: string;
  name?: string;
};

type SentryCaptureContext = {
  extras?: Record<string, unknown>;
  tags?: Record<string, string>;
};

const APP_ENVIRONMENT = import.meta.env.MODE;
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN?.trim() ?? "";
const SENTRY_ENVIRONMENT =
  import.meta.env.VITE_SENTRY_ENVIRONMENT?.trim() || APP_ENVIRONMENT;
const SENTRY_ENABLED =
  import.meta.env.VITE_SENTRY_ENABLED?.trim().toLowerCase() === "true";
const SHOULD_FILTER_SMOKE_EVENTS =
  SENTRY_ENVIRONMENT.toLowerCase() !== "development";
const SENTRY_SMOKE_MARKERS = [
  "sentry smoke test",
  "codex sentry smoke",
  "codex-ingest-check-final",
  "dev_sentry_smoke",
  "/dev/sentry-smoke",
];

let sentryStarted = false;

function parseSampleRate(value: string | undefined, fallback: number) {
  const parsed = Number.parseFloat(value ?? "");

  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.min(1, parsed));
}

export const isSentryEnabled = SENTRY_ENABLED && Boolean(SENTRY_DSN);

function hasSmokeMarker(value: unknown) {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return false;
  }

  const normalized = value.toLowerCase();
  return SENTRY_SMOKE_MARKERS.some((marker) => normalized.includes(marker));
}

function isSmokeTestEvent(event: Sentry.Event) {
  if (hasSmokeMarker(event.message) || hasSmokeMarker(event.transaction)) {
    return true;
  }

  if (hasSmokeMarker(event.request?.url)) {
    return true;
  }

  if (
    event.tags?.flow === "dev_sentry_smoke" ||
    String(event.tags?.smoke_test ?? "").toLowerCase() === "true"
  ) {
    return true;
  }

  if (
    event.extra?.smokeTest === true ||
    String(event.extra?.smokeTest ?? "").toLowerCase() === "true"
  ) {
    return true;
  }

  if (
    event.exception?.values?.some(
      (value) => hasSmokeMarker(value.value) || hasSmokeMarker(value.type),
    )
  ) {
    return true;
  }

  return Object.values(event.tags ?? {}).some((value) =>
    hasSmokeMarker(String(value)),
  );
}

// Link Sentry issues to PostHog: tag each event with the current PostHog
// distinct_id so a Sentry error can be traced to the person — and their session
// replay / events — in PostHog. (posthog-js's own Sentry integration targets the
// legacy setupOnce/getCurrentHub API that @sentry/react v10 removed, so we wire
// the link manually here, which is version-agnostic.)
function getPostHogDistinctId(): string | null {
  if (!isPostHogEnabled) {
    return null;
  }

  try {
    const distinctId = posthog.get_distinct_id();
    return typeof distinctId === "string" && distinctId ? distinctId : null;
  } catch {
    return null;
  }
}

// Tag a Sentry event (error or transaction) with the current PostHog distinct_id
// so both error and performance/tracing events carry the PostHog link.
function tagEventWithPostHog<T extends Sentry.Event>(event: T): T {
  const posthogDistinctId = getPostHogDistinctId();
  if (posthogDistinctId) {
    event.tags = { ...event.tags, posthog_distinct_id: posthogDistinctId };
  }
  return event;
}

export function initSentry() {
  if (!isSentryEnabled || sentryStarted) {
    return;
  }

  const tracesSampleRate = parseSampleRate(
    import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE,
    1,
  );
  const replaysSessionSampleRate = parseSampleRate(
    import.meta.env.VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE,
    0,
  );
  const replaysOnErrorSampleRate = parseSampleRate(
    import.meta.env.VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE,
    0.1,
  );
  const integrations = [
    Sentry.reactRouterV7BrowserTracingIntegration({
      createRoutesFromChildren,
      matchRoutes,
      useEffect,
      useLocation,
      useNavigationType,
    }),
  ];

  if (replaysSessionSampleRate > 0 || replaysOnErrorSampleRate > 0) {
    integrations.push(Sentry.replayIntegration());
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    integrations,
    tracesSampleRate,
    replaysSessionSampleRate,
    replaysOnErrorSampleRate,
    ignoreErrors: [
      // DIS-263: browser extensions (Grammarly, Google Translate, password
      // managers, etc.) mutate the DOM out from under React's reconciliation
      // and surface as this unhandled rejection. It carries no stack, is not
      // triggered by app code, and fires from injected extension scripts —
      // not our sign-in/auth-callback flow. Safe to drop as noise.
      /Object Not Found Matching Id/,
    ],
    beforeSend(event) {
      if (SHOULD_FILTER_SMOKE_EVENTS && isSmokeTestEvent(event)) {
        return null;
      }

      return tagEventWithPostHog(event);
    },
    beforeSendTransaction(event) {
      if (SHOULD_FILTER_SMOKE_EVENTS && isSmokeTestEvent(event)) {
        return null;
      }

      return tagEventWithPostHog(event);
    },
  });

  sentryStarted = true;
}

export function syncSentryUser(user: SentryUserContext | null) {
  if (!isSentryEnabled) {
    return;
  }

  if (!user) {
    Sentry.setUser(null);
    Sentry.setTag("email_domain", "anonymous");
    return;
  }

  // Identify with a non-reversible hash only — no raw email/name to Sentry.
  Sentry.setUser({
    id: hashAnalyticsIdentifierSync(user.id),
  });
  Sentry.setTag("email_domain", user.emailDomain ?? "unknown");
}

export function captureSentryException(
  error: unknown,
  context?: SentryCaptureContext,
) {
  if (!isSentryEnabled) {
    return;
  }

  Sentry.withScope((scope) => {
    Object.entries(context?.extras ?? {}).forEach(([key, value]) => {
      scope.setExtra(key, value);
    });
    Object.entries(context?.tags ?? {}).forEach(([key, value]) => {
      scope.setTag(key, value);
    });
    Sentry.captureException(error);
  });
}
