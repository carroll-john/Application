export type Section1StepKey =
  | "basic-info"
  | "personal-contact"
  | "contact-info"
  | "address"
  | "cultural-background"
  | "family-support";

export interface Section1StepAnalytics {
  routeKey: string;
  routeLabel: string;
  stepKey: string;
  stepLabel: string;
}

export interface Section1StepDefinition {
  key: Section1StepKey;
  path: string;
  previousPath: string;
  continuePath: string;
  progress: number;
  title: string;
  description: string;
  sectionLabel: "Section 1 of 3";
  analytics: Section1StepAnalytics;
}

export const SECTION1_SECTION_LABEL = "Section 1 of 3" as const;

export const section1Steps: Section1StepDefinition[] = [
  {
    key: "basic-info",
    path: "/section1/basic-info",
    previousPath: "/overview",
    continuePath: "/section1/personal-contact",
    progress: 17,
    title: "Your basic information",
    description: "Let's start with some basic details about you.",
    sectionLabel: SECTION1_SECTION_LABEL,
    analytics: {
      routeKey: "basic_information",
      routeLabel: "Basic information",
      stepKey: "section1_basic_info",
      stepLabel: "Basic information",
    },
  },
  {
    key: "personal-contact",
    path: "/section1/personal-contact",
    previousPath: "/section1/basic-info",
    continuePath: "/section1/contact-info",
    progress: 33,
    title: "Personal contact details",
    description: "Tell us about your gender, date of birth, and how to contact you.",
    sectionLabel: SECTION1_SECTION_LABEL,
    analytics: {
      routeKey: "personal_contact_details",
      routeLabel: "Personal contact details",
      stepKey: "section1_personal_contact",
      stepLabel: "Personal contact details",
    },
  },
  {
    key: "contact-info",
    path: "/section1/contact-info",
    previousPath: "/section1/personal-contact",
    continuePath: "/section1/address",
    progress: 45,
    title: "Citizenship information",
    description: "We need a few details about your citizenship and country of birth.",
    sectionLabel: SECTION1_SECTION_LABEL,
    analytics: {
      routeKey: "citizenship_information",
      routeLabel: "Citizenship information",
      stepKey: "section1_contact_info",
      stepLabel: "Citizenship information",
    },
  },
  {
    key: "address",
    path: "/section1/address",
    previousPath: "/section1/contact-info",
    continuePath: "/section1/cultural-background",
    progress: 56,
    title: "Address details",
    description: "Tell us where you live and whether your postal address is different.",
    sectionLabel: SECTION1_SECTION_LABEL,
    analytics: {
      routeKey: "address_details",
      routeLabel: "Address details",
      stepKey: "section1_address",
      stepLabel: "Address details",
    },
  },
  {
    key: "cultural-background",
    path: "/section1/cultural-background",
    previousPath: "/section1/address",
    continuePath: "/section1/family-support",
    progress: 67,
    title: "Cultural and education background",
    description:
      "These questions support government reporting and student support planning. They do not affect your admission outcome.",
    sectionLabel: SECTION1_SECTION_LABEL,
    analytics: {
      routeKey: "cultural_background",
      routeLabel: "Cultural background",
      stepKey: "section1_cultural_background",
      stepLabel: "Cultural background",
    },
  },
  {
    key: "family-support",
    path: "/section1/family-support",
    previousPath: "/section1/cultural-background",
    continuePath: "/section2/qualifications",
    progress: 100,
    title: "Family & Support Information",
    description:
      "These answers support required reporting and help us arrange reasonable adjustments if you need them. They do not affect your admission outcome.",
    sectionLabel: SECTION1_SECTION_LABEL,
    analytics: {
      routeKey: "family_support",
      routeLabel: "Family support",
      stepKey: "section1_family_support",
      stepLabel: "Family support",
    },
  },
];

const section1StepByKey = Object.fromEntries(
  section1Steps.map((step) => [step.key, step]),
) as Record<Section1StepKey, Section1StepDefinition>;

export function getSection1Step(key: Section1StepKey) {
  return section1StepByKey[key];
}

export function getSection1StepByPath(path: string) {
  return section1Steps.find((step) => step.path === path) ?? null;
}

export function section1PathPattern(path: string) {
  return new RegExp(`^${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
}

export function buildSection1ApplicationStepDefinitions() {
  return section1Steps.map((step, index) => ({
    group: "section1" as const,
    key: step.analytics.stepKey,
    label: step.analytics.stepLabel,
    order: index + 2,
    pattern: section1PathPattern(step.path),
  }));
}

export function buildSection1RouteAnalyticsDefinitions() {
  return section1Steps.map((step) => ({
    group: "application" as const,
    key: step.analytics.routeKey,
    label: step.analytics.routeLabel,
    pattern: section1PathPattern(step.path),
  }));
}
