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

let sentryStarted = false;

function parseSampleRate(value: string | undefined, fallback: number) {
  const parsed = Number.parseFloat(value ?? "");

  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.min(1, parsed));
}

export const isSentryEnabled = Boolean(SENTRY_DSN);

export function initSentry() {
  if (!isSentryEnabled || sentryStarted) {
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    integrations: [
      Sentry.reactRouterV7BrowserTracingIntegration({
        createRoutesFromChildren,
        matchRoutes,
        useEffect,
        useLocation,
        useNavigationType,
      }),
    ],
    tracesSampleRate: parseSampleRate(
      import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE,
      1,
    ),
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
