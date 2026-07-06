import posthog, { type CaptureResult } from "posthog-js";
import { hashAnalyticsIdentifier } from "../analyticsIdentity";
import { getEmailDomain } from "../emailDomain";
import type { AnalyticsEventMap, AnalyticsEventName } from "./events";
import { sanitizeAnalyticsUrl } from "./sanitizeAnalyticsUrl";
import {
  APP_ENVIRONMENT,
  AUTOMATION_USER_AGENT_PATTERN,
  BOT_USER_AGENT_PATTERN,
  POSTHOG_KEY,
  POSTHOG_UI_HOST,
  SYNTHETIC_TEST_QUERY_PARAM,
  SYNTHETIC_TEST_STORAGE_KEY,
  SYNTHETIC_TEST_TOKEN,
  type PostHogUserContext,
} from "./posthogTypes";

let postHogStarted = false;
let postHogBlockReason: string | null = null;
let postHogIdentifyRequestId = 0;

export const isPostHogEnabled = Boolean(POSTHOG_KEY);
export const POSTHOG_IDENTITY_VERSION = 1;

// Properties that can carry a full URL (and therefore auth tokens in the hash or
// query). With the real SDK, `capture_pageleave` auto-populates `$current_url`
// from `window.location`, so these must be sanitized before every send.
const SANITIZED_URL_EVENT_PROPERTIES = [
  "$current_url",
  "$referrer",
  "$pathname",
] as const;

function sanitizeEventUrlProperties(
  properties: CaptureResult["properties"] | undefined,
) {
  if (!properties) {
    return;
  }

  for (const key of SANITIZED_URL_EVENT_PROPERTIES) {
    const value = properties[key];
    if (typeof value === "string" && value) {
      properties[key] = sanitizeAnalyticsUrl(value);
    }
  }
}

// A token is "live" only when one is configured at build time and the provided
// value matches it exactly — kept pure so it is unit-testable without globals.
export function matchesSyntheticTestToken(
  configuredToken: string,
  providedToken: string | null | undefined,
): boolean {
  return Boolean(configuredToken) && providedToken === configuredToken;
}

function readStoredSyntheticToken(): string | null {
  try {
    return window.localStorage?.getItem(SYNTHETIC_TEST_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function readQuerySyntheticToken(): string | null {
  try {
    return new URLSearchParams(window.location.search).get(
      SYNTHETIC_TEST_QUERY_PARAM,
    );
  } catch {
    return null;
  }
}

// Is this an authorised synthetic-test session? True when the matching token is
// present in localStorage (sticky once activated) or in the current URL's query
// string (which we then persist so it survives SPA navigation).
function isSyntheticTestSession(): boolean {
  if (!SYNTHETIC_TEST_TOKEN || typeof window === "undefined") {
    return false;
  }

  if (matchesSyntheticTestToken(SYNTHETIC_TEST_TOKEN, readStoredSyntheticToken())) {
    return true;
  }

  if (matchesSyntheticTestToken(SYNTHETIC_TEST_TOKEN, readQuerySyntheticToken())) {
    try {
      window.localStorage?.setItem(
        SYNTHETIC_TEST_STORAGE_KEY,
        SYNTHETIC_TEST_TOKEN,
      );
    } catch {
      // localStorage may be unavailable; query-param detection still holds for this load.
    }
    // Scrub the token from the URL/history so it can't reach analytics via
    // $current_url/$referrer (the sanitizer also strips kp_synthetic as a
    // defense-in-depth backstop).
    stripSyntheticTokenFromUrl();
    return true;
  }

  return false;
}

function stripSyntheticTokenFromUrl() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(SYNTHETIC_TEST_QUERY_PARAM)) {
      return;
    }
    url.searchParams.delete(SYNTHETIC_TEST_QUERY_PARAM);
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  } catch {
    // history/URL APIs unavailable — the sanitizer backstop still applies.
  }
}

// Register the super-properties carried on every event. `synthetic_test: true`
// is stamped on authorised QA sessions so their events can be filtered out of
// real metrics. Re-applied after reset() (which clears super-properties).
function registerBaseSuperProperties() {
  posthog.register({
    app_environment: APP_ENVIRONMENT,
    ...(isSyntheticTestSession() ? { synthetic_test: true } : {}),
  });
}

function detectPostHogBlockReason() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return null;
  }

  // Let authorised synthetic test traffic through the bot filter — its events
  // are tagged `synthetic_test: true` (see registerBaseSuperProperties) so they
  // stay separable from real applicant data.
  if (isSyntheticTestSession()) {
    return null;
  }

  const userAgent = navigator.userAgent?.toLowerCase() ?? "";

  if (navigator.webdriver) {
    return "webdriver";
  }

  const runtimeWindow = window as Window & {
    __playwright__binding__?: unknown;
    Cypress?: unknown;
  };

  if (runtimeWindow.__playwright__binding__) {
    return "playwright_runtime";
  }
  if (runtimeWindow.Cypress) {
    return "cypress_runtime";
  }

  if (AUTOMATION_USER_AGENT_PATTERN.test(userAgent)) {
    return "automation_user_agent";
  }
  if (BOT_USER_AGENT_PATTERN.test(userAgent)) {
    return "bot_user_agent";
  }

  return null;
}

export function canCapturePostHog() {
  if (!isPostHogEnabled) {
    return false;
  }

  if (!postHogBlockReason) {
    postHogBlockReason = detectPostHogBlockReason();
    if (postHogBlockReason && import.meta.env.DEV) {
      console.info(`[posthog] capture disabled for ${postHogBlockReason}`);
    }
  }

  return !postHogBlockReason;
}

// Single choke point applied to every outgoing event: drop everything when
// capture is disabled (bots/automation), and strip auth tokens from any
// URL-bearing properties so they never leave the browser.
function beforeSendPostHog(event: CaptureResult | null): CaptureResult | null {
  if (!event) {
    return null;
  }

  if (!canCapturePostHog()) {
    return null;
  }

  sanitizeEventUrlProperties(event.properties);
  return event;
}

export function initPostHog() {
  if (!canCapturePostHog() || postHogStarted) {
    return;
  }

  posthog.init(POSTHOG_KEY, {
    // Route analytics through the same-origin `/ingest` reverse proxy
    // (vercel.json) for ad-blocker resilience. The proxy previously 404'd on
    // the deployment (DIS-196), silently dropping every capture, so the app
    // temporarily sent events directly to POSTHOG_HOST. Re-verified working
    // end-to-end on 2026-07-04: GET /ingest/flags/ returns PostHog flags JSON
    // and POST /ingest/i/v0/e/ reaches PostHog's parser (see
    // docs/posthog-integrations.md §3). If events ever stop arriving, check
    // the proxy first and revert this one line to `api_host: POSTHOG_HOST`;
    // the funnel bot's [ingest:*] logs (scripts/synthetic-funnel-bot.mjs)
    // show whether the proxy forwards (200) or drops (404) captures.
    api_host: "/ingest",
    ui_host: POSTHOG_UI_HOST,
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: true,
    // Disable posthog-js's built-in user-agent bot filter so OUR synthetic-aware
    // gate (canCapturePostHog / beforeSendPostHog / the loaded opt-out below) is
    // the single source of truth. The SDK's own filter is not synthetic-aware:
    // it drops every capture from a headless/webdriver session (navigator.webdriver
    // === true), which silently discarded all authorised synthetic-test traffic —
    // the events were captured client-side but never reached PostHog. Real bots are
    // still blocked here because canCapturePostHog() returns false for them — and
    // BOT_USER_AGENT_PATTERN mirrors the SDK's DEFAULT_BLOCKED_UA_STRS coverage so
    // opting out doesn't let previously-filtered crawlers (Lighthouse, prerender,
    // vercel-screenshot, …) through.
    opt_out_useragent_filter: true,
    persistence: "localStorage+cookie",
    person_profiles: "identified_only",
    // Replay is default-disabled and started per route via syncReplayRoutePrivacy
    // (public catalog routes only). Inputs and text are masked while it runs.
    disable_session_recording: true,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: "*",
    },
    before_send: beforeSendPostHog,
    loaded: (loadedPostHog) => {
      if (!canCapturePostHog()) {
        loadedPostHog.opt_out_capturing();
      }
    },
  });
  registerBaseSuperProperties();
  postHogStarted = true;
}

// Routes that show authenticated or otherwise sensitive content. Session replay
// is stopped on these (ported from the previous Clarity PII-route list); replay
// only runs on the public catalog routes.
const REPLAY_PII_ROUTE_PATTERNS = [
  /^\/sign-in$/,
  /^\/auth\/callback$/,
  /^\/profile$/,
  /^\/dashboard$/,
  /^\/overview$/,
  /^\/section1(?:\/|$)/,
  /^\/section2(?:\/|$)/,
  /^\/review$/,
  /^\/submitted$/,
  /^\/profile-recommendations$/,
];

export function isReplayPiiRoute(pathname: string) {
  // Normalize a trailing slash so `/profile/` is treated the same as `/profile`
  // (React Router matches both), otherwise replay would wrongly start on a
  // trailing-slash authenticated route.
  const normalizedPathname =
    pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return REPLAY_PII_ROUTE_PATTERNS.some((pattern) =>
    pattern.test(normalizedPathname),
  );
}

// Default-deny session replay: started only on non-PII (public catalog) routes
// and stopped whenever the user is on a sensitive route. Inputs/text are masked
// whenever replay is active (see the session_recording config in initPostHog).
export function syncReplayRoutePrivacy(pathname: string) {
  if (!canCapturePostHog()) {
    return;
  }

  initPostHog();

  if (isReplayPiiRoute(pathname)) {
    posthog.stopSessionRecording();
    return;
  }

  posthog.startSessionRecording();
}

export function syncPostHogUser(user: PostHogUserContext | null) {
  if (!canCapturePostHog()) {
    return;
  }

  initPostHog();

  postHogIdentifyRequestId += 1;
  const requestId = postHogIdentifyRequestId;

  if (!user) {
    posthog.reset();
    registerBaseSuperProperties();
    return;
  }

  const emailDomain = user.emailDomain ?? getEmailDomain(user.email) ?? "unknown";

  void hashAnalyticsIdentifier(user.id).then((hashedUserId) => {
    if (requestId !== postHogIdentifyRequestId || !canCapturePostHog()) {
      return;
    }

    posthog.identify(hashedUserId, {
      app_environment: APP_ENVIRONMENT,
      analytics_user_id_hash: hashedUserId,
      email_domain: emailDomain,
      is_authenticated: true,
      posthog_identity_version: POSTHOG_IDENTITY_VERSION,
      user_type: "applicant",
    });
  });
}

// Associate the current person with their course provider as a PostHog group,
// so analytics can be segmented by institution. Group associations persist until
// reset() (logout) and are re-asserted whenever a course flow re-runs.
export function associateCourseProviderGroup(
  provider: string | null | undefined,
) {
  if (!canCapturePostHog() || !provider) {
    return;
  }

  initPostHog();
  posthog.group("course_provider", provider, { name: provider });
}

export function capturePostHogEvent<EventName extends AnalyticsEventName>(
  eventName: EventName,
  properties?: AnalyticsEventMap[EventName],
) {
  if (!canCapturePostHog()) {
    return;
  }

  initPostHog();

  posthog.capture(eventName, {
    app_environment: APP_ENVIRONMENT,
    ...properties,
  });
}
