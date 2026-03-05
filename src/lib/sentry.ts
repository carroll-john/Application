import * as Sentry from "@sentry/react";
import { useEffect } from "react";
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from "react-router-dom";

type SentryUserContext = {
  companyDomain?: string;
  email?: string;
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
    beforeSend(event) {
      return SHOULD_FILTER_SMOKE_EVENTS && isSmokeTestEvent(event) ? null : event;
    },
    beforeSendTransaction(event) {
      return SHOULD_FILTER_SMOKE_EVENTS && isSmokeTestEvent(event)
        ? null
        : event;
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
    Sentry.setTag("company_domain", "anonymous");
    return;
  }

  Sentry.setUser({
    email: user.email,
    id: user.id,
    username: user.name,
  });
  Sentry.setTag("company_domain", user.companyDomain ?? "unknown");
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
