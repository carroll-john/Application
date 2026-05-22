import { getRequiredFunnelStepDefinition } from "./applicationSteps";
import { hashAnalyticsIdentifier } from "../analyticsIdentity";
import { captureClarityEvent } from "../clarity";
import {
  APP_ENVIRONMENT,
  AUTOMATION_USER_AGENT_PATTERN,
  BOT_USER_AGENT_PATTERN,
  POSTHOG_HOST,
  POSTHOG_KEY,
  type PostHogQueue,
  type PostHogUserContext,
} from "./posthogTypes";

type StubbedMethod = "capture" | "identify" | "register" | "reset";

let postHogStarted = false;
let postHogBlockReason: string | null = null;
let postHogIdentifyRequestId = 0;

export const isPostHogEnabled = Boolean(POSTHOG_KEY);

function buildScriptUrl(apiHost: string) {
  if (apiHost.includes(".i.posthog.com")) {
    return `${apiHost.replace(".i.posthog.com", "-assets.i.posthog.com")}/static/array.js`;
  }

  return `${apiHost}/static/array.js`;
}

function stubMethod(target: PostHogQueue, methodName: StubbedMethod) {
  const methods = target as PostHogQueue &
    Record<StubbedMethod, (...args: unknown[]) => void>;

  methods[methodName] = (...args: unknown[]) => {
    target.push([methodName, ...args]);
  };
}

function ensurePostHogBootstrap() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  const existing = window.posthog;

  if (existing?.__SV) {
    return existing;
  }

  const queue = (existing ?? []) as PostHogQueue;
  queue._i = queue._i ?? [];

  queue.init = (token, config, name) => {
    const namedQueue = queue as unknown as Record<string, PostHogQueue | undefined>;
    const instance = name
      ? (namedQueue[name] ?? ([] as PostHogQueue))
      : queue;

    if (name) {
      namedQueue[name] = instance;
    }

    stubMethod(instance, "capture");
    stubMethod(instance, "identify");
    stubMethod(instance, "register");
    stubMethod(instance, "reset");
    queue._i?.push([token, config, name]);
  };

  queue.__SV = 1.2;
  window.posthog = queue;

  if (!document.querySelector('script[data-posthog-loader="true"]')) {
    const script = document.createElement("script");
    const firstScript = document.getElementsByTagName("script")[0];

    script.async = true;
    script.src = buildScriptUrl(POSTHOG_HOST);
    script.setAttribute("data-posthog-loader", "true");

    if (firstScript?.parentNode) {
      firstScript.parentNode.insertBefore(script, firstScript);
    } else {
      document.head.appendChild(script);
    }
  }

  return queue;
}

function getPostHogClient() {
  if (!canCapturePostHog()) {
    return null;
  }

  return ensurePostHogBootstrap();
}

function registerBaseProperties() {
  window.posthog?.register?.({
    app_environment: APP_ENVIRONMENT,
  });
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

export function initPostHog() {
  if (!canCapturePostHog() || postHogStarted) {
    return;
  }

  const client = getPostHogClient();

  if (!client?.init) {
    return;
  }

  client.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    autocapture: false,
    capture_pageleave: true,
    capture_pageview: false,
    persistence: "localStorage+cookie",
  });
  registerBaseProperties();
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
    window.posthog?.reset?.();
    registerBaseProperties();
    return;
  }

  const emailDomain = user.emailDomain ?? user.email?.split("@")[1] ?? "unknown";

  void hashAnalyticsIdentifier(user.id).then((hashedUserId) => {
    if (requestId !== postHogIdentifyRequestId || !canCapturePostHog()) {
      return;
    }

    window.posthog?.identify?.(hashedUserId, {
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

  const unsubscribe = window.posthog?.onFeatureFlags?.(callback);
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

  window.posthog?.capture?.(eventName, {
    app_environment: APP_ENVIRONMENT,
    ...properties,
  });

  if (!requiredFunnelStepDefinition) {
    return;
  }

  window.posthog?.capture?.(requiredFunnelStepDefinition.eventName, {
    app_environment: APP_ENVIRONMENT,
    funnel_source_event: eventName,
    required_funnel_step_label: requiredFunnelStepDefinition.stepLabel,
    required_funnel_step_number: requiredFunnelStepDefinition.stepNumber,
    ...properties,
  });
}
