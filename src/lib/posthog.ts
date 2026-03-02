import type { ApplicationData } from "./applicationData";

type PostHogConfig = {
  api_host: string;
  autocapture: boolean;
  capture_pageleave: boolean;
  capture_pageview: boolean;
  persistence: "localStorage+cookie";
};

type PostHogUserContext = {
  companyDomain?: string;
  email?: string;
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

type ApplicationStepDefinition = {
  group: "overview" | "review" | "section1" | "section2" | "submitted";
  key: string;
  label: string;
  order: number;
  pattern: RegExp;
};

type RouteAnalyticsDefinition = {
  group:
    | "application"
    | "auth"
    | "catalog"
    | "dashboard"
    | "profile"
    | "system";
  key: string;
  label: string;
  pattern: RegExp;
};

type PostHogQueue = Array<[string, ...unknown[]]> & {
  __SV?: number;
  _i?: Array<[string, PostHogConfig, string?]>;
  capture?: (eventName: string, properties?: Record<string, unknown>) => void;
  identify?: (
    distinctId: string,
    properties?: Record<string, unknown>,
  ) => void;
  init?: (token: string, config: PostHogConfig, name?: string) => void;
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

let postHogStarted = false;
let lastTrackedPageKey: string | null = null;
let lastTrackedApplicationStepKey: string | null = null;
let postHogBlockReason: string | null = null;

const routeAnalyticsDefinitions: RouteAnalyticsDefinition[] = [
  {
    group: "catalog",
    key: "course_catalog",
    label: "Course catalog",
    pattern: /^\/$/,
  },
  {
    group: "catalog",
    key: "course_details",
    label: "Course details",
    pattern: /^\/courses\/[^/]+$/,
  },
  {
    group: "auth",
    key: "sign_in",
    label: "Sign in",
    pattern: /^\/sign-in$/,
  },
  {
    group: "auth",
    key: "auth_callback",
    label: "Auth callback",
    pattern: /^\/auth\/callback$/,
  },
  {
    group: "profile",
    key: "profile",
    label: "Applicant profile",
    pattern: /^\/profile$/,
  },
  {
    group: "dashboard",
    key: "dashboard",
    label: "Application dashboard",
    pattern: /^\/dashboard$/,
  },
  {
    group: "application",
    key: "application_overview",
    label: "Application overview",
    pattern: /^\/overview$/,
  },
  {
    group: "application",
    key: "basic_information",
    label: "Basic information",
    pattern: /^\/section1\/basic-info$/,
  },
  {
    group: "application",
    key: "personal_contact_details",
    label: "Personal contact details",
    pattern: /^\/section1\/personal-contact$/,
  },
  {
    group: "application",
    key: "citizenship_information",
    label: "Citizenship information",
    pattern: /^\/section1\/contact-info$/,
  },
  {
    group: "application",
    key: "address_details",
    label: "Address details",
    pattern: /^\/section1\/address$/,
  },
  {
    group: "application",
    key: "cultural_background",
    label: "Cultural background",
    pattern: /^\/section1\/cultural-background$/,
  },
  {
    group: "application",
    key: "family_support",
    label: "Family support",
    pattern: /^\/section1\/family-support$/,
  },
  {
    group: "application",
    key: "qualifications_overview",
    label: "Qualifications overview",
    pattern: /^\/section2\/qualifications$/,
  },
  {
    group: "application",
    key: "tertiary_qualification",
    label: "Tertiary qualification",
    pattern: /^\/section2\/(?:add-tertiary|edit-tertiary\/[^/]+)$/,
  },
  {
    group: "application",
    key: "employment_experience",
    label: "Employment experience",
    pattern: /^\/section2\/(?:add-employment|edit-employment\/[^/]+)$/,
  },
  {
    group: "application",
    key: "professional_accreditation",
    label: "Professional accreditation",
    pattern: /^\/section2\/(?:add-accreditation|edit-accreditation\/[^/]+)$/,
  },
  {
    group: "application",
    key: "secondary_qualification",
    label: "Secondary qualification",
    pattern: /^\/section2\/(?:add-secondary|edit-secondary\/[^/]+)$/,
  },
  {
    group: "application",
    key: "language_test",
    label: "Language test",
    pattern: /^\/section2\/(?:add-language-test|edit-language-test\/[^/]+)$/,
  },
  {
    group: "application",
    key: "cv_upload",
    label: "CV upload",
    pattern: /^\/section2\/add-cv$/,
  },
  {
    group: "application",
    key: "review_and_submit",
    label: "Review and submit",
    pattern: /^\/review$/,
  },
  {
    group: "application",
    key: "application_submitted",
    label: "Application submitted",
    pattern: /^\/submitted$/,
  },
  {
    group: "application",
    key: "profile_recommendations",
    label: "Profile recommendations",
    pattern: /^\/profile-recommendations$/,
  },
  {
    group: "system",
    key: "dev_sentry_smoke",
    label: "Dev Sentry smoke test",
    pattern: /^\/dev\/sentry-smoke$/,
  },
];

const applicationStepDefinitions: ApplicationStepDefinition[] = [
  {
    group: "overview",
    key: "overview",
    label: "Application overview",
    order: 1,
    pattern: /^\/overview$/,
  },
  {
    group: "section1",
    key: "section1_basic_info",
    label: "Basic information",
    order: 2,
    pattern: /^\/section1\/basic-info$/,
  },
  {
    group: "section1",
    key: "section1_personal_contact",
    label: "Personal contact details",
    order: 3,
    pattern: /^\/section1\/personal-contact$/,
  },
  {
    group: "section1",
    key: "section1_contact_info",
    label: "Citizenship information",
    order: 4,
    pattern: /^\/section1\/contact-info$/,
  },
  {
    group: "section1",
    key: "section1_address",
    label: "Address details",
    order: 5,
    pattern: /^\/section1\/address$/,
  },
  {
    group: "section1",
    key: "section1_cultural_background",
    label: "Cultural background",
    order: 6,
    pattern: /^\/section1\/cultural-background$/,
  },
  {
    group: "section1",
    key: "section1_family_support",
    label: "Family support",
    order: 7,
    pattern: /^\/section1\/family-support$/,
  },
  {
    group: "section2",
    key: "section2_qualifications",
    label: "Qualifications overview",
    order: 8,
    pattern: /^\/section2\/qualifications$/,
  },
  {
    group: "section2",
    key: "section2_tertiary_qualification",
    label: "Tertiary qualification",
    order: 9,
    pattern: /^\/section2\/(?:add-tertiary|edit-tertiary\/[^/]+)$/,
  },
  {
    group: "section2",
    key: "section2_employment_experience",
    label: "Employment experience",
    order: 10,
    pattern: /^\/section2\/(?:add-employment|edit-employment\/[^/]+)$/,
  },
  {
    group: "section2",
    key: "section2_professional_accreditation",
    label: "Professional accreditation",
    order: 11,
    pattern: /^\/section2\/(?:add-accreditation|edit-accreditation\/[^/]+)$/,
  },
  {
    group: "section2",
    key: "section2_secondary_qualification",
    label: "Secondary qualification",
    order: 12,
    pattern: /^\/section2\/(?:add-secondary|edit-secondary\/[^/]+)$/,
  },
  {
    group: "section2",
    key: "section2_language_test",
    label: "Language test",
    order: 13,
    pattern: /^\/section2\/(?:add-language-test|edit-language-test\/[^/]+)$/,
  },
  {
    group: "section2",
    key: "section2_cv",
    label: "CV upload",
    order: 14,
    pattern: /^\/section2\/add-cv$/,
  },
  {
    group: "review",
    key: "review_and_submit",
    label: "Review and submit",
    order: 15,
    pattern: /^\/review$/,
  },
  {
    group: "submitted",
    key: "submitted",
    label: "Submitted application",
    order: 16,
    pattern: /^\/submitted$/,
  },
];

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
    autocapture: true,
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

  if (!user) {
    window.posthog?.reset?.();
    registerBaseProperties();
    return;
  }

  window.posthog?.identify?.(user.id, {
    app_environment: APP_ENVIRONMENT,
    company_domain: user.companyDomain ?? "unknown",
    email: user.email,
    name: user.name,
  });
}

export function capturePostHogEvent(
  eventName: string,
  properties?: Record<string, unknown>,
) {
  if (!canCapturePostHog()) {
    return;
  }

  initPostHog();

  window.posthog?.capture?.(eventName, {
    app_environment: APP_ENVIRONMENT,
    ...properties,
  });
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
  return {
    ...getCourseAnalyticsProperties(application?.applicationMeta?.selectedCourse),
    applicant_profile_id: application?.applicationMeta?.applicantProfileId ?? null,
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

export function getRouteAnalyticsDefinition(pathname: string) {
  return routeAnalyticsDefinitions.find((route) => route.pattern.test(pathname)) ?? null;
}

export function getApplicationStepDefinition(pathname: string) {
  return applicationStepDefinitions.find((step) => step.pattern.test(pathname)) ?? null;
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
