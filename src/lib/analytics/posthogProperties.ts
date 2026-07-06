import type { ApplicationData } from "../applicationData";
import { hashAnalyticsIdentifierSync } from "../analyticsIdentity";
import type { ApplicationStepEventName } from "./events";
import {
  getApplicationStepDefinition,
  getRouteAnalyticsDefinition,
} from "./applicationSteps";
import {
  isPostHogSensitiveRoute,
  sanitizeAnalyticsSearch,
  sanitizeAnalyticsUrl,
} from "./sanitizeAnalyticsUrl";
import {
  canCapturePostHog,
  capturePostHogEvent,
  initPostHog,
} from "./posthogClient";

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

let lastTrackedPageKey: string | null = null;
let lastTrackedApplicationStepKey: string | null = null;

type RouteTrackingOptions = {
  application?: ApplicationAnalyticsContext | null;
  isHydrating?: boolean;
};

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

function hasApplicationRouteContext(
  properties: ReturnType<typeof getApplicationAnalyticsProperties> | null,
) {
  return Boolean(properties?.application_id && properties.course_code);
}

function getApplicationRouteContextKey(
  properties: ReturnType<typeof getApplicationAnalyticsProperties>,
) {
  return `${properties.application_id}:${properties.course_code}`;
}

export function captureApplicationStepEvent(
  eventName: ApplicationStepEventName,
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

export function trackPostHogPageView(
  pathname: string,
  search = "",
  options: RouteTrackingOptions = {},
) {
  if (isPostHogSensitiveRoute(pathname, search) || !canCapturePostHog()) {
    return;
  }

  const route = getRouteAnalyticsDefinition(pathname);
  const routeGroup = route?.group ?? "system";
  const applicationProperties =
    routeGroup === "application"
      ? getApplicationAnalyticsProperties(options.application)
      : null;

  if (routeGroup === "application") {
    if (options.isHydrating || !hasApplicationRouteContext(applicationProperties)) {
      return;
    }
  }

  const sanitizedSearch = sanitizeAnalyticsSearch(search);
  const pageKey =
    routeGroup === "application" && applicationProperties
      ? `${pathname}${sanitizedSearch}:${getApplicationRouteContextKey(applicationProperties)}`
      : `${pathname}${sanitizedSearch}`;

  if (pageKey === lastTrackedPageKey) {
    return;
  }

  initPostHog();
  lastTrackedPageKey = pageKey;

  const safeUrl =
    typeof window !== "undefined"
      ? sanitizeAnalyticsUrl(window.location.href)
      : `${pathname}${sanitizedSearch}`;

  capturePostHogEvent("$pageview", {
    $current_url: safeUrl,
    $pathname: pathname,
    page_group: route?.group ?? "system",
    page_key: route?.key ?? "unknown_page",
    page_name: route?.label ?? "Unknown page",
    ...(applicationProperties ?? {}),
  });
}

export function trackApplicationStepView(
  pathname: string,
  application: ApplicationAnalyticsContext | null | undefined,
  options: Pick<RouteTrackingOptions, "isHydrating"> = {},
) {
  const stepProperties = getApplicationStepAnalyticsProperties(pathname, application);

  if (!stepProperties) {
    lastTrackedApplicationStepKey = null;
    return;
  }

  if (options.isHydrating || !hasApplicationRouteContext(stepProperties)) {
    return;
  }

  const stepKey = `${pathname}:${getApplicationRouteContextKey(stepProperties)}`;

  if (stepKey === lastTrackedApplicationStepKey) {
    return;
  }

  lastTrackedApplicationStepKey = stepKey;

  capturePostHogEvent("application_step_viewed", stepProperties);
}
