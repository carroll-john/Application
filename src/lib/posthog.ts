import type { ApplicationData } from "./applicationData";
import {
  getApplicationStepDefinition,
  getRequiredFunnelStepDefinition,
  getRouteAnalyticsDefinition,
} from "./analytics/applicationSteps";
import {
  hashAnalyticsIdentifier,
  hashAnalyticsIdentifierSync,
} from "./analyticsIdentity";
import { captureClarityEvent } from "./clarity";

type PostHogConfig = {
  api_host: string;
  autocapture: boolean;
  capture_pageleave: boolean;
  capture_pageview: boolean;
  persistence: "localStorage+cookie";
};

type PostHogUserContext = {
  email?: string;
  emailDomain?: string;
  id: string;
  name?: string;
};

type CourseAnalyticsContext = {
  code?: string;
  intake?: string;
  intakeLabel?: string;
  provider?: string;
  title?: string;
};

type ApplicationAnalyticsContext = Partial<
  Pick<
    ApplicationData,
    | "applicationMeta"
    | "cvUploaded"
    | "employmentExperiences"
    | "languageTests"
    | "professionalAccreditations"
    | "secondaryQualifications"
    | "tertiaryQualifications"
  >
>;

type PostHogQueue = Array<[string, ...unknown[]]> & {
  __SV?: number;
  _i?: Array<[string, PostHogConfig, string?]>;
  capture?: (eventName: string, properties?: Record<string, unknown>) => void;
  getFeatureFlag?: (key: string) => boolean | string | undefined;
  identify?: (
    distinctId: string,
    properties?: Record<string, unknown>,
  ) => void;
  init?: (token: string, config: PostHogConfig, name?: string) => void;
  isFeatureEnabled?: (key: string) => boolean | undefined;
  onFeatureFlags?: (callback: () => void) => (() => void) | void;
  register?: (properties: Record<string, unknown>) => void;
  reset?: () => void;
};

type StubbedMethod = "capture" | "identify" | "register" | "reset";

declare global {
  interface Window {
    posthog?: PostHogQueue;
  }
}

const APP_ENVIRONMENT = import.meta.env.MODE;
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY?.trim() ?? "";
const POSTHOG_HOST = (
  import.meta.env.VITE_POSTHOG_HOST?.trim() || "https://us.i.posthog.com"
).replace(/\/+$/, "");
const BOT_USER_AGENT_PATTERN =
  /(bot|spider|crawl|slurp|bingpreview|headless|phantomjs|ahrefsbot|semrushbot|mj12bot|dotbot|facebookexternalhit|gptbot|chatgpt-user|claudebot|anthropic-ai|perplexitybot|bytespider|duckduckbot|baiduspider|yandexbot|applebot)/i;
const AUTOMATION_USER_AGENT_PATTERN =
  /(playwright|puppeteer|cypress|selenium|webdriver|postmanruntime|insomnia|curl|wget|python-requests)/i;
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

let postHogStarted = false;
let lastTrackedPageKey: string | null = null;
let lastTrackedApplicationStepKey: string | null = null;
let postHogBlockReason: string | null = null;
let postHogIdentifyRequestId = 0;

export interface CvParserExperimentState {
  enabled: boolean;
  source: "posthog" | "fallback";
  variant: string | boolean | null;
}

export type AiExperimentState = CvParserExperimentState;

export const CV_PARSER_FEATURE_FLAG_KEY =
  import.meta.env.VITE_POSTHOG_CV_PARSER_FLAG?.trim() ||
  "cv_parser_autofill_experiment";

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

  queue.init = (token: string, config: PostHogConfig, name?: string) => {
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

export const isPostHogEnabled = Boolean(POSTHOG_KEY);

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

function canCapturePostHog() {
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

function normalizeFeatureFlagVariant(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  return ENABLED_VARIANTS.has(value.trim().toLowerCase());
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

export function getCourseAnalyticsProperties(
  course: CourseAnalyticsContext | null | undefined,
) {
  return {
    course_code: course?.code ?? null,
    course_intake: course?.intake ?? course?.intakeLabel ?? null,
    course_provider: course?.provider ?? null,
    course_title: course?.title ?? null,
  };
}

export function getApplicationAnalyticsProperties(
  application: ApplicationAnalyticsContext | null | undefined,
) {
  const rawApplicantProfileId = application?.applicationMeta?.applicantProfileId ?? null;

  return {
    ...getCourseAnalyticsProperties(application?.applicationMeta?.selectedCourse),
    applicant_profile_id: rawApplicantProfileId
      ? hashAnalyticsIdentifierSync(rawApplicantProfileId)
      : null,
    application_has_cv: Boolean(application?.cvUploaded),
    application_id: application?.applicationMeta?.recordId ?? null,
    application_number: application?.applicationMeta?.applicationNumber ?? null,
    application_status: application?.applicationMeta?.status ?? "draft",
    employment_experience_count: application?.employmentExperiences?.length ?? 0,
    language_test_count: application?.languageTests?.length ?? 0,
    professional_accreditation_count:
      application?.professionalAccreditations?.length ?? 0,
    secondary_qualification_count:
      application?.secondaryQualifications?.length ?? 0,
    tertiary_qualification_count:
      application?.tertiaryQualifications?.length ?? 0,
  };
}

function getApplicationStepAnalyticsProperties(
  pathname: string,
  application: ApplicationAnalyticsContext | null | undefined,
) {
  const step = getApplicationStepDefinition(pathname);

  if (!step) {
    return null;
  }

  const route = getRouteAnalyticsDefinition(pathname);

  return {
    ...getApplicationAnalyticsProperties(application),
    application_route_path: pathname,
    application_step_group: step.group,
    application_step_key: step.key,
    application_step_label: step.label,
    application_step_order: step.order,
    page_group: route?.group ?? "application",
    page_key: route?.key ?? step.key,
    page_name: route?.label ?? step.label,
  };
}

export function captureApplicationStepEvent(
  eventName: string,
  {
    application,
    pathname,
    properties,
  }: {
    application: ApplicationAnalyticsContext | null | undefined;
    pathname: string;
    properties?: Record<string, unknown>;
  },
) {
  const stepProperties = getApplicationStepAnalyticsProperties(pathname, application);

  if (!stepProperties) {
    return;
  }

  capturePostHogEvent(eventName, {
    ...stepProperties,
    ...properties,
  });
}

export function trackPostHogPageView(pathname: string, search = "") {
  if (!canCapturePostHog()) {
    return;
  }

  initPostHog();

  const pageKey = `${pathname}${search}`;

  if (pageKey === lastTrackedPageKey) {
    return;
  }

  lastTrackedPageKey = pageKey;

  const route = getRouteAnalyticsDefinition(pathname);

  window.posthog?.capture?.("$pageview", {
    $current_url: window.location.href,
    $pathname: pathname,
    app_environment: APP_ENVIRONMENT,
    page_group: route?.group ?? "system",
    page_key: route?.key ?? "unknown_page",
    page_name: route?.label ?? "Unknown page",
  });
}

export function trackApplicationStepView(
  pathname: string,
  application: ApplicationAnalyticsContext | null | undefined,
) {
  const stepProperties = getApplicationStepAnalyticsProperties(pathname, application);

  if (!stepProperties) {
    lastTrackedApplicationStepKey = null;
    return;
  }

  if (pathname === lastTrackedApplicationStepKey) {
    return;
  }

  lastTrackedApplicationStepKey = pathname;

  capturePostHogEvent("application_step_viewed", stepProperties);
}

export {
  getApplicationStepDefinition,
  getRequiredFunnelStepDefinition,
  getRouteAnalyticsDefinition,
} from "./analytics/applicationSteps";
