import type { ApplicationData } from "../applicationData";
import { hashAnalyticsIdentifierSync } from "../analyticsIdentity";
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
  if (isPostHogSensitiveRoute(pathname, search) || !canCapturePostHog()) {
    return;
  }

  initPostHog();

  const sanitizedSearch = sanitizeAnalyticsSearch(search);
  const pageKey = `${pathname}${sanitizedSearch}`;

  if (pageKey === lastTrackedPageKey) {
    return;
  }

  lastTrackedPageKey = pageKey;

  const route = getRouteAnalyticsDefinition(pathname);
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
