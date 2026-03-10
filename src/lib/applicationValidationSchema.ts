import type {
  ApplicationData,
  EmploymentExperience,
  TertiaryQualification,
} from "./applicationData";
import { isMonthYearRangeOutOfOrder } from "./monthYearValidation";
import {
  getSection2RequirementInput,
  getSection2SubmissionMissingFields,
} from "./section2Requirements";

export type ValidationTarget = "stepComplete" | "submissionReady";

export type StepCompletionLabel =
  | "Basic information"
  | "Personal contact details"
  | "Citizenship information"
  | "Address details"
  | "CV upload"
  | "Employment experience"
  | "Tertiary qualifications";

export interface ValidationIssue {
  section: string;
  subsection: string;
  field: string;
  path: string;
  stepLabel?: StepCompletionLabel;
}

interface ValidationRule {
  section: string;
  subsection: string;
  field: string;
  path: string;
  stepLabel?: StepCompletionLabel;
  targets: ValidationTarget[];
  isMissing: (data: ApplicationData, target: ValidationTarget) => boolean;
}

interface TertiaryFieldRule {
  field: string;
  isMissing: (qualification: TertiaryQualification) => boolean;
}

const SECTION_1 = "Section 1: Personal information";
const SECTION_2 = "Section 2: Qualifications";
const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

const stepCompletionOrder: StepCompletionLabel[] = [
  "Basic information",
  "Personal contact details",
  "Citizenship information",
  "Address details",
  "CV upload",
  "Employment experience",
  "Tertiary qualifications",
];

const baseValidationRules: ValidationRule[] = [
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

const tertiaryFieldRules: TertiaryFieldRule[] = [
  {
    field: "Institution Name",
    isMissing: (qualification) => !qualification.institution.trim(),
  },
  {
    field: "Country",
    isMissing: (qualification) => !qualification.country,
  },
  {
    field: "Qualification Level",
    isMissing: (qualification) => !qualification.level,
  },
  {
    field: "Course Name",
    isMissing: (qualification) => !qualification.courseName.trim(),
  },
  {
    field: "Start date",
    isMissing: (qualification) =>
      !qualification.startMonth || !qualification.startYear,
  },
  {
    field: "End date",
    isMissing: (qualification) => !qualification.endMonth || !qualification.endYear,
  },
  {
    field: "Start date must be before or the same as end date",
    isMissing: (qualification) =>
      isMonthYearRangeOutOfOrder(
        qualification.startMonth,
        qualification.startYear,
        qualification.endMonth,
        qualification.endYear,
      ),
  },
  {
    field: "Academic Transcript",
    isMissing: (qualification) =>
      Boolean(qualification.courseName.trim()) &&
      !hasStoredDocument(
        qualification.transcriptDocument,
        qualification.transcriptDocumentName,
      ),
  },
  {
    field: "Certificate of Completion",
    isMissing: (qualification) =>
      qualification.completed &&
      !hasStoredDocument(
        qualification.certificateDocument,
        qualification.certificateDocumentName,
      ),
  },
];

function hasStoredDocument(
  document: TertiaryQualification["transcriptDocument"] | undefined,
  documentName: string | undefined,
) {
  return Boolean(document || documentName);
}

function getValidationRules(data: ApplicationData): ValidationRule[] {
  const rules = [...baseValidationRules];
  const parentCount = Number(data.contactDetails.parentsCount || 0);
  const parentValues = [
    data.contactDetails.parent1Details,
    data.contactDetails.parent2Details,
    data.contactDetails.parent3Details,
    data.contactDetails.parent4Details,
    data.contactDetails.parent5Details,
  ];

  parentValues.slice(0, parentCount).forEach((value, index) => {
    rules.push({
      section: SECTION_1,
      subsection: "Family & support information",
      field: `Parent/Guardian ${index + 1} Education Level`,
      path: "/section1/family-support?from=review",
      targets: ["submissionReady"],
      isMissing: () => !value?.trim(),
    });
  });

  getSection2SubmissionMissingFields(getSection2RequirementInput(data)).forEach(
    (field) => {
      rules.push({
        section: SECTION_2,
        subsection: "Submission requirements",
        field,
        path: "/section2/qualifications?from=review",
        stepLabel: "Tertiary qualifications",
        targets: ["stepComplete", "submissionReady"],
        isMissing: () => true,
      });
    },
  );

  data.tertiaryQualifications.forEach((qualification, index) => {
    const path = `/section2/edit-tertiary/${qualification.id}?from=review`;

    getTertiaryQualificationSubmissionMissingFields(qualification).forEach((field) => {
      rules.push({
        section: SECTION_2,
        subsection: "Tertiary qualifications",
        field: `Qualification ${index + 1}: ${field}`,
        path,
        targets: ["submissionReady"],
        isMissing: () => true,
      });
    });
  });

  data.employmentExperiences.forEach((experience, index) => {
    if (isEmploymentExperienceChronologyValid(experience)) {
      return;
    }

    rules.push({
      section: SECTION_2,
      subsection: "Employment experience",
      field: `Employment ${index + 1}: Start date must be before or the same as end date`,
      path: `/section2/edit-employment/${experience.id}?from=review`,
      targets: ["submissionReady"],
      isMissing: () => true,
    });
  });

  return rules;
}
export function getTertiaryQualificationSubmissionMissingFields(
  qualification: TertiaryQualification,
) {
  return tertiaryFieldRules
    .filter((rule) => rule.isMissing(qualification))
    .map((rule) => rule.field);
}

export function isTertiaryQualificationSubmissionReady(
  qualification: TertiaryQualification,
) {
  return getTertiaryQualificationSubmissionMissingFields(qualification).length === 0;
}

export function isEmploymentExperienceChronologyValid(
  experience: EmploymentExperience,
) {
  if (experience.currentRole) {
    return true;
  }

  return !isMonthYearRangeOutOfOrder(
    experience.startMonth,
    experience.startYear,
    experience.endMonth,
    experience.endYear,
  );
}

export function getValidationIssues(
  data: ApplicationData,
  target: ValidationTarget,
): ValidationIssue[] {
  return getValidationRules(data)
    .filter((rule) => rule.targets.includes(target))
    .filter((rule) => rule.isMissing(data, target))
    .map((rule) => ({
      field: rule.field,
      path: rule.path,
      section: rule.section,
      subsection: rule.subsection,
      stepLabel: rule.stepLabel,
    }));
}

export function getSubmissionValidationIssues(data: ApplicationData) {
  return getValidationIssues(data, "submissionReady");
}

export function isSubmissionReady(data: ApplicationData) {
  return getSubmissionValidationIssues(data).length === 0;
}

export function getNextIncompleteStep(data: ApplicationData) {
  const missingStepLabels = new Set(
    getValidationIssues(data, "stepComplete")
      .map((issue) => issue.stepLabel)
      .filter((label): label is StepCompletionLabel => Boolean(label)),
  );

  return (
    stepCompletionOrder.find((stepLabel) => missingStepLabels.has(stepLabel)) ?? null
  );
}

export function getStepCompletionSummary(data: ApplicationData) {
  const missingStepLabels = new Set(
    getValidationIssues(data, "stepComplete")
      .map((issue) => issue.stepLabel)
      .filter((label): label is StepCompletionLabel => Boolean(label)),
  );
  const totalSteps = stepCompletionOrder.length;
  const completedSteps = totalSteps - missingStepLabels.size;

  return {
    completedSteps,
    completionPercentage:
      totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
    totalSteps,
  };
}
