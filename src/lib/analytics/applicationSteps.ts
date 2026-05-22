import {
  buildSection1ApplicationStepDefinitions,
  buildSection1RouteAnalyticsDefinitions,
} from "../section1Steps";
import {
  buildSection2ApplicationStepDefinitions,
  buildSection2RouteAnalyticsDefinitions,
} from "../section2Steps";

export type ApplicationStepDefinition = {
  group: "overview" | "review" | "section1" | "section2" | "submitted";
  key: string;
  label: string;
  order: number;
  pattern: RegExp;
};

export type RequiredFunnelStepDefinition = {
  eventName: string;
  sourceEventName:
    | "application_step_viewed"
    | "application_step_completed"
    | "application_submit_started";
  stepLabel: string;
  stepNumber: 3 | 4 | 5;
};

export type RouteAnalyticsDefinition = {
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

export const routeAnalyticsDefinitions: RouteAnalyticsDefinition[] = [
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
  ...buildSection1RouteAnalyticsDefinitions(),
  ...buildSection2RouteAnalyticsDefinitions(),
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

export const applicationStepDefinitions: ApplicationStepDefinition[] = [
  {
    group: "overview",
    key: "overview",
    label: "Application overview",
    order: 1,
    pattern: /^\/overview$/,
  },
  ...buildSection1ApplicationStepDefinitions(),
  ...buildSection2ApplicationStepDefinitions(),
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

export const requiredFunnelStepDefinitions: RequiredFunnelStepDefinition[] = [
  {
    eventName: "funnel_step_3_application_step_viewed",
    sourceEventName: "application_step_viewed",
    stepLabel: "Application step viewed",
    stepNumber: 3,
  },
  {
    eventName: "funnel_step_4_application_step_completed",
    sourceEventName: "application_step_completed",
    stepLabel: "Application step completed",
    stepNumber: 4,
  },
  {
    eventName: "funnel_step_5_application_submit_started",
    sourceEventName: "application_submit_started",
    stepLabel: "Application submit started",
    stepNumber: 5,
  },
];

export function getRouteAnalyticsDefinition(pathname: string) {
  return routeAnalyticsDefinitions.find((route) => route.pattern.test(pathname)) ?? null;
}

export function getApplicationStepDefinition(pathname: string) {
  return applicationStepDefinitions.find((step) => step.pattern.test(pathname)) ?? null;
}

export function getRequiredFunnelStepDefinition(sourceEventName: string) {
  return (
    requiredFunnelStepDefinitions.find(
      (definition) => definition.sourceEventName === sourceEventName,
    ) ?? null
  );
}
