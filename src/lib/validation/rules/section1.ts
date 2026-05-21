import type { ApplicationData } from "../../applicationData";
import {
  EMAIL_PATTERN,
  SECTION_1,
  type ValidationRule,
  type ValidationTarget,
} from "../types";

export const section1ValidationRules: ValidationRule[] = [
  {
    section: SECTION_1,
    subsection: "Basic information",
    field: "Title",
    path: "/section1/basic-info?from=review",
    stepLabel: "Basic information",
    targets: ["stepComplete", "submissionReady"],
    isMissing: (data) => !data.personalDetails.title,
  },
  {
    section: SECTION_1,
    subsection: "Basic information",
    field: "First name",
    path: "/section1/basic-info?from=review",
    stepLabel: "Basic information",
    targets: ["stepComplete", "submissionReady"],
    isMissing: (data) => !data.personalDetails.firstName.trim(),
  },
  {
    section: SECTION_1,
    subsection: "Basic information",
    field: "Last name",
    path: "/section1/basic-info?from=review",
    stepLabel: "Basic information",
    targets: ["stepComplete", "submissionReady"],
    isMissing: (data) => !data.personalDetails.lastName.trim(),
  },
  {
    section: SECTION_1,
    subsection: "Personal contact details",
    field: "Gender",
    path: "/section1/personal-contact?from=review",
    stepLabel: "Personal contact details",
    targets: ["stepComplete", "submissionReady"],
    isMissing: (data) => !data.personalDetails.gender,
  },
  {
    section: SECTION_1,
    subsection: "Personal contact details",
    field: "Date of birth",
    path: "/section1/personal-contact?from=review",
    stepLabel: "Personal contact details",
    targets: ["stepComplete", "submissionReady"],
    isMissing: (data) => !data.personalDetails.dateOfBirth,
  },
  {
    section: SECTION_1,
    subsection: "Personal contact details",
    field: "Email address",
    path: "/section1/personal-contact?from=review",
    stepLabel: "Personal contact details",
    targets: ["stepComplete", "submissionReady"],
    isMissing: (data) => !data.personalDetails.email.trim(),
  },
  {
    section: SECTION_1,
    subsection: "Personal contact details",
    field: "Valid email",
    path: "/section1/personal-contact?from=review",
    targets: ["submissionReady"],
    isMissing: (data) =>
      Boolean(data.personalDetails.email.trim()) &&
      !EMAIL_PATTERN.test(data.personalDetails.email),
  },
  {
    section: SECTION_1,
    subsection: "Personal contact details",
    field: "Phone number",
    path: "/section1/personal-contact?from=review",
    stepLabel: "Personal contact details",
    targets: ["stepComplete", "submissionReady"],
    isMissing: (data) => !data.personalDetails.phone.trim(),
  },
  {
    section: SECTION_1,
    subsection: "Citizenship information",
    field: "Citizenship status",
    path: "/section1/contact-info?from=review",
    stepLabel: "Citizenship information",
    targets: ["stepComplete", "submissionReady"],
    isMissing: (data) => !data.contactDetails.citizenshipStatus,
  },
  {
    section: SECTION_1,
    subsection: "Address details",
    field: "Permanent residential address",
    path: "/section1/address?from=review",
    stepLabel: "Address details",
    targets: ["stepComplete", "submissionReady"],
    isMissing: (data) => !data.contactDetails.residentialAddress.formattedAddress.trim(),
  },
  {
    section: SECTION_1,
    subsection: "Cultural & education background",
    field: "Language spoken",
    path: "/section1/cultural-background?from=review",
    targets: ["submissionReady"],
    isMissing: (data) => !data.contactDetails.language,
  },
  {
    section: SECTION_1,
    subsection: "Cultural & education background",
    field: "Aboriginal status",
    path: "/section1/cultural-background?from=review",
    targets: ["submissionReady"],
    isMissing: (data) => !data.contactDetails.aboriginal,
  },
  {
    section: SECTION_1,
    subsection: "Cultural & education background",
    field: "School level",
    path: "/section1/cultural-background?from=review",
    targets: ["submissionReady"],
    isMissing: (data) => !data.contactDetails.schoolLevel,
  },
];

export function getFamilySupportRules(data: ApplicationData): ValidationRule[] {
  const parentCount = Number(data.contactDetails.parentsCount || 0);
  const parentValues = [
    data.contactDetails.parent1Details,
    data.contactDetails.parent2Details,
    data.contactDetails.parent3Details,
    data.contactDetails.parent4Details,
    data.contactDetails.parent5Details,
  ];

  return [
    {
      section: SECTION_1,
      subsection: "Family & support information",
      field: "Number of parents/guardians",
      path: "/section1/family-support?from=review",
      targets: ["submissionReady"],
      isMissing: (application) => !application.contactDetails.parentsCount,
    },
    {
      section: SECTION_1,
      subsection: "Family & support information",
      field: "Disability, impairment or long-term condition",
      path: "/section1/family-support?from=review",
      targets: ["submissionReady"],
      isMissing: (application) => application.contactDetails.hasDisability === null,
    },
    {
      section: SECTION_1,
      subsection: "Family & support information",
      field: "Disability support details",
      path: "/section1/family-support?from=review",
      targets: ["submissionReady"],
      isMissing: (application) =>
        application.contactDetails.hasDisability === true &&
        !application.contactDetails.disabilityDetails.trim(),
    },
    ...parentValues.slice(0, parentCount).map((value, index) => ({
      section: SECTION_1,
      subsection: "Family & support information",
      field: `Parent/Guardian ${index + 1} Education Level`,
      path: "/section1/family-support?from=review",
      targets: ["submissionReady"] as ValidationTarget[],
      isMissing: () => !value?.trim(),
    })),
  ];
}
