export type Section1StepKey =
  | "basic-info"
  | "personal-contact"
  | "contact-info"
  | "address"
  | "cultural-background"
  | "family-support";

export interface Section1StepDefinition {
  key: Section1StepKey;
  path: string;
  previousPath: string;
  continuePath: string;
  progress: number;
  title: string;
  description: string;
  sectionLabel: "Section 1 of 3";
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
