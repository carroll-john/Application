import posthog, { type CaptureResult } from "posthog-js";
import { getRequiredFunnelStepDefinition } from "./applicationSteps";
import { hashAnalyticsIdentifier } from "../analyticsIdentity";
import { captureClarityEvent } from "../clarity";
import { sanitizeAnalyticsUrl } from "./sanitizeAnalyticsUrl";
import {
  APP_ENVIRONMENT,
  AUTOMATION_USER_AGENT_PATTERN,
  BOT_USER_AGENT_PATTERN,
  POSTHOG_HOST,
  POSTHOG_KEY,
  POSTHOG_UI_HOST,
  type PostHogUserContext,
} from "./posthogTypes";

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
    api_host: POSTHOG_HOST,
    ui_host: POSTHOG_UI_HOST,
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: true,
    persistence: "localStorage+cookie",
    person_profiles: "identified_only",
    disable_session_recording: true,
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
  const requiredFunnelStepDefinition = getRequiredFunnelStepDefinition(eventName);

  if (requiredFunnelStepDefinition) {
    captureClarityEvent(requiredFunnelStepDefinition.eventName);
  }

  if (!canCapturePostHog()) {
    return;
  }

  initPostHog();

  posthog.capture(eventName, {
    app_environment: APP_ENVIRONMENT,
    ...properties,
  });

  if (!requiredFunnelStepDefinition) {
    return;
  }

  posthog.capture(requiredFunnelStepDefinition.eventName, {
    app_environment: APP_ENVIRONMENT,
    funnel_source_event: eventName,
    required_funnel_step_label: requiredFunnelStepDefinition.stepLabel,
    required_funnel_step_number: requiredFunnelStepDefinition.stepNumber,
    ...properties,
  });
}
