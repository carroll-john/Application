import posthog, { type CaptureResult } from "posthog-js";
import { hashAnalyticsIdentifier } from "../analyticsIdentity";
import { sanitizeAnalyticsUrl } from "./sanitizeAnalyticsUrl";
import {
  APP_ENVIRONMENT,
  AUTOMATION_USER_AGENT_PATTERN,
  BOT_USER_AGENT_PATTERN,
  POSTHOG_KEY,
  POSTHOG_UI_HOST,
  type PostHogUserContext,
} from "./posthogTypes";

// Same-origin reverse-proxy path (configured in vercel.json) so analytics
// requests are first-party and are not dropped by ad-blockers. It proxies to
// the EU ingestion host, with /ingest/static/* and /ingest/array/* (the SDK's
// static assets and remote config) going to the EU assets host.
const POSTHOG_INGEST_PROXY_PATH = "/ingest";

let postHogStarted = false;
let postHogBlockReason: string | null = null;
let postHogIdentifyRequestId = 0;

export const isPostHogEnabled = Boolean(POSTHOG_KEY);

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

function detectPostHogBlockReason() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
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
    api_host: POSTHOG_INGEST_PROXY_PATH,
    ui_host: POSTHOG_UI_HOST,
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: true,
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
  posthog.register({ app_environment: APP_ENVIRONMENT });
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
  return REPLAY_PII_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
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
    posthog.register({ app_environment: APP_ENVIRONMENT });
    return;
  }

  const emailDomain = user.emailDomain ?? user.email?.split("@")[1] ?? "unknown";

  void hashAnalyticsIdentifier(user.id).then((hashedUserId) => {
    if (requestId !== postHogIdentifyRequestId || !canCapturePostHog()) {
      return;
    }

    posthog.identify(hashedUserId, {
      app_environment: APP_ENVIRONMENT,
      analytics_user_id_hash: hashedUserId,
      email_domain: emailDomain,
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

export function onPostHogFeatureFlags(callback: () => void) {
  if (!canCapturePostHog()) {
    return () => {};
  }

  initPostHog();

  const unsubscribe = posthog.onFeatureFlags(callback);
  return typeof unsubscribe === "function" ? unsubscribe : () => {};
}

export function capturePostHogEvent(
  eventName: string,
  properties?: Record<string, unknown>,
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
