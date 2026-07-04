import * as Sentry from "@sentry/node";

const SENTRY_FLUSH_TIMEOUT_MS = 1_500;
const SENTRY_DSN =
  process.env.SENTRY_DSN?.trim() || process.env.VITE_SENTRY_DSN?.trim() || "";
const SENTRY_ENVIRONMENT =
  process.env.SENTRY_ENVIRONMENT?.trim() ||
  process.env.VITE_SENTRY_ENVIRONMENT?.trim() ||
  process.env.VERCEL_ENV?.trim() ||
  process.env.NODE_ENV ||
  "development";
const SHOULD_FILTER_SMOKE_EVENTS =
  SENTRY_ENVIRONMENT.toLowerCase() !== "development";
const SENTRY_RELEASE =
  process.env.SENTRY_RELEASE?.trim() || process.env.VERCEL_GIT_COMMIT_SHA?.trim();
const SENTRY_ENABLED_VALUE =
  process.env.SENTRY_ENABLED?.trim() ?? process.env.VITE_SENTRY_ENABLED?.trim();
export const SENTRY_AGENT_NAME =
  process.env.SENTRY_AGENT_NAME?.trim() || "cv-parser-employment-agent";
export const SENTRY_AI_RECORD_INPUTS =
  process.env.SENTRY_AI_RECORD_INPUTS?.trim().toLowerCase() === "true";
export const SENTRY_AI_RECORD_OUTPUTS =
  process.env.SENTRY_AI_RECORD_OUTPUTS?.trim().toLowerCase() === "true";
const SENTRY_TRACES_SAMPLE_RATE = parseSampleRate(
  process.env.SENTRY_TRACES_SAMPLE_RATE?.trim() ||
    process.env.VITE_SENTRY_TRACES_SAMPLE_RATE?.trim(),
  0.1,
);
export const IS_API_SENTRY_ENABLED =
  Boolean(SENTRY_DSN) &&
  (!SENTRY_ENABLED_VALUE || SENTRY_ENABLED_VALUE.toLowerCase() === "true");
export const IS_API_SENTRY_TRACING_ENABLED =
  IS_API_SENTRY_ENABLED && SENTRY_TRACES_SAMPLE_RATE > 0;
const SENTRY_SMOKE_MARKERS = [
  "sentry smoke test",
  "codex sentry smoke",
  "codex-ingest-check-final",
  "dev_sentry_smoke",
  "/dev/sentry-smoke",
];

type SentryEventContext = {
  extras?: Record<string, unknown>;
  tags?: Record<string, string>;
};

type SentryMessageContext = SentryEventContext & {
  level?: "debug" | "log" | "info" | "warning" | "error" | "fatal";
};

function parseSampleRate(value: string | undefined, fallback: number) {
  const parsed = Number.parseFloat(value ?? "");

  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.min(1, parsed));
}

function hasSmokeMarker(value: unknown): boolean {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  const normalized = value.toLowerCase();
  return SENTRY_SMOKE_MARKERS.some((marker) => normalized.includes(marker));
}

function isSmokeSentryEvent(event: Sentry.Event) {
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

let apiSentryStarted = false;

function initApiSentry() {
  if (!IS_API_SENTRY_ENABLED || apiSentryStarted) {
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    release: SENTRY_RELEASE || undefined,
    tracesSampleRate: SENTRY_TRACES_SAMPLE_RATE,
    beforeSend(event) {
      return SHOULD_FILTER_SMOKE_EVENTS && isSmokeSentryEvent(event) ? null : event;
    },
    beforeSendTransaction(event) {
      return SHOULD_FILTER_SMOKE_EVENTS && isSmokeSentryEvent(event)
        ? null
        : event;
    },
  });

  apiSentryStarted = true;
}

initApiSentry();

export async function flushSentry() {
  if (!IS_API_SENTRY_ENABLED) {
    return;
  }

  try {
    await Sentry.flush(SENTRY_FLUSH_TIMEOUT_MS);
  } catch {
    // Best effort capture only.
  }
}

function withSentryScope(context: SentryEventContext | undefined, callback: () => void) {
  Sentry.withScope((scope) => {
    Object.entries(context?.tags ?? {}).forEach(([key, value]) => {
      scope.setTag(key, value);
    });
    Object.entries(context?.extras ?? {}).forEach(([key, value]) => {
      scope.setExtra(key, value);
    });
    callback();
  });
}

export async function captureApiException(error: unknown, context?: SentryEventContext) {
  if (!IS_API_SENTRY_ENABLED) {
    return;
  }

  const errorObject =
    error instanceof Error ? error : new Error(typeof error === "string" ? error : "Unknown error");

  withSentryScope(context, () => {
    Sentry.captureException(errorObject);
  });
}

export async function captureApiMessage(message: string, context?: SentryMessageContext) {
  if (!IS_API_SENTRY_ENABLED) {
    return;
  }

  withSentryScope(context, () => {
    Sentry.captureMessage(message, context?.level ?? "error");
  });
}

function getApiRoute(request: Request) {
  try {
    return new URL(request.url).pathname;
  } catch {
    return "unknown";
  }
}

export function buildSentryContext(
  request: Request,
  extras?: Record<string, unknown>,
  tags?: Record<string, string>,
) {
  return {
    extras: {
      request_method: request.method,
      ...extras,
    },
    tags: {
      api_route: getApiRoute(request),
      ...tags,
    },
  };
}
