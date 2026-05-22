export const SECTION2_QUALIFICATIONS_PATH = "/section2/qualifications" as const;
export const SECTION2_SECTION_LABEL = "Section 2 of 3" as const;

export type Section2StepKey =
  | "qualifications"
  | "tertiary"
  | "employment"
  | "accreditation"
  | "secondary"
  | "language-test"
  | "cv";

export interface Section2StepAnalytics {
  routeKey: string;
  routeLabel: string;
  stepKey: string;
  stepLabel: string;
}

export interface Section2StepDefinition {
  key: Section2StepKey;
  pathPattern: RegExp;
  addPath?: string;
  editPathPrefix?: string;
  order: number;
  analytics: Section2StepAnalytics;
}

export const section2Steps: Section2StepDefinition[] = [
  {
    key: "qualifications",
    pathPattern: /^\/section2\/qualifications$/,
    order: 8,
    analytics: {
      routeKey: "qualifications_overview",
      routeLabel: "Qualifications overview",
      stepKey: "section2_qualifications",
      stepLabel: "Qualifications overview",
    },
  },
  {
    key: "tertiary",
    pathPattern: /^\/section2\/(?:add-tertiary|edit-tertiary\/[^/]+)$/,
    addPath: "/section2/add-tertiary",
    editPathPrefix: "/section2/edit-tertiary",
    order: 9,
    analytics: {
      routeKey: "tertiary_qualification",
      routeLabel: "Tertiary qualification",
      stepKey: "section2_tertiary_qualification",
      stepLabel: "Tertiary qualification",
    },
  },
  {
    key: "employment",
    pathPattern: /^\/section2\/(?:add-employment|edit-employment\/[^/]+)$/,
    addPath: "/section2/add-employment",
    editPathPrefix: "/section2/edit-employment",
    order: 10,
    analytics: {
      routeKey: "employment_experience",
      routeLabel: "Employment experience",
      stepKey: "section2_employment_experience",
      stepLabel: "Employment experience",
    },
  },
  {
    key: "accreditation",
    pathPattern: /^\/section2\/(?:add-accreditation|edit-accreditation\/[^/]+)$/,
    addPath: "/section2/add-accreditation",
    editPathPrefix: "/section2/edit-accreditation",
    order: 11,
    analytics: {
      routeKey: "professional_accreditation",
      routeLabel: "Professional accreditation",
      stepKey: "section2_professional_accreditation",
      stepLabel: "Professional accreditation",
    },
  },
  {
    key: "secondary",
    pathPattern: /^\/section2\/(?:add-secondary|edit-secondary\/[^/]+)$/,
    addPath: "/section2/add-secondary",
    editPathPrefix: "/section2/edit-secondary",
    order: 12,
    analytics: {
      routeKey: "secondary_qualification",
      routeLabel: "Secondary qualification",
      stepKey: "section2_secondary_qualification",
      stepLabel: "Secondary qualification",
    },
  },
  {
    key: "language-test",
    pathPattern: /^\/section2\/(?:add-language-test|edit-language-test\/[^/]+)$/,
    addPath: "/section2/add-language-test",
    editPathPrefix: "/section2/edit-language-test",
    order: 13,
    analytics: {
      routeKey: "language_test",
      routeLabel: "Language test",
      stepKey: "section2_language_test",
      stepLabel: "Language test",
    },
  },
  {
    key: "cv",
    pathPattern: /^\/section2\/add-cv$/,
    addPath: "/section2/add-cv",
    order: 14,
    analytics: {
      routeKey: "cv_upload",
      routeLabel: "CV upload",
      stepKey: "section2_cv",
      stepLabel: "CV upload",
    },
  },
];

const section2StepByKey = Object.fromEntries(
  section2Steps.map((step) => [step.key, step]),
) as Record<Section2StepKey, Section2StepDefinition>;

export function getSection2Step(key: Section2StepKey) {
  return section2StepByKey[key];
}

export function getSection2StepByPath(pathname: string) {
  return section2Steps.find((step) => step.pathPattern.test(pathname)) ?? null;
}

export function getSection2EditPath(key: Section2StepKey, id: string) {
  const step = getSection2Step(key);
  if (!step.editPathPrefix) {
    return step.addPath ?? SECTION2_QUALIFICATIONS_PATH;
  }

  return `${step.editPathPrefix}/${id}`;
}

export function buildSection2ApplicationStepDefinitions() {
  return section2Steps.map((step) => ({
    group: "section2" as const,
    key: step.analytics.stepKey,
    label: step.analytics.stepLabel,
    order: step.order,
    pattern: step.pathPattern,
  }));
}

export function buildSection2RouteAnalyticsDefinitions() {
  return section2Steps.map((step) => ({
    group: "application" as const,
    key: step.analytics.routeKey,
    label: step.analytics.routeLabel,
    pattern: step.pathPattern,
  }));
}
