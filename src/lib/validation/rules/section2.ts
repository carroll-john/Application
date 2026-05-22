import type {
  ApplicationData,
  EmploymentExperience,
  TertiaryQualification,
} from "../../applicationData";
import { isSubmissionReadyDocument } from "../../documentAttachment";
import { isMonthYearRangeOutOfOrder } from "../../monthYearValidation";
import {
  getSection2RequirementInput,
  getSection2SubmissionMissingFields,
} from "../../section2Requirements";
import { SECTION_2, type ValidationRule } from "../types";

interface TertiaryFieldRule {
  field: string;
  isMissing: (qualification: TertiaryQualification) => boolean;
}

function hasStoredDocument(
  document: TertiaryQualification["transcriptDocument"] | undefined,
) {
  return isSubmissionReadyDocument(document);
}

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
      !hasStoredDocument(qualification.transcriptDocument),
  },
  {
    field: "Certificate of Completion",
    isMissing: (qualification) =>
      qualification.completed &&
      !hasStoredDocument(qualification.certificateDocument),
  },
];

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

export function getSection2RequirementRules(data: ApplicationData): ValidationRule[] {
  return getSection2SubmissionMissingFields(getSection2RequirementInput(data)).map(
    (field) => ({
      section: SECTION_2,
      subsection: "Submission requirements",
      field,
      path: "/section2/qualifications?from=review",
      stepLabel: "Tertiary qualifications",
      targets: ["stepComplete", "submissionReady"],
      isMissing: () => true,
    }),
  );
}

export function getTertiaryQualificationRules(data: ApplicationData): ValidationRule[] {
  return data.tertiaryQualifications.flatMap((qualification, index) => {
    const path = `/section2/edit-tertiary/${qualification.id}?from=review`;

    return getTertiaryQualificationSubmissionMissingFields(qualification).map(
      (field) => ({
        section: SECTION_2,
        subsection: "Tertiary qualifications",
        field: `Qualification ${index + 1}: ${field}`,
        path,
        targets: ["submissionReady"],
        isMissing: () => true,
      }),
    );
  });
}

export function getEmploymentChronologyRules(data: ApplicationData): ValidationRule[] {
  return data.employmentExperiences.flatMap((experience, index) =>
    isEmploymentExperienceChronologyValid(experience)
      ? []
      : [
          {
            section: SECTION_2,
            subsection: "Employment experience",
            field: `Employment ${index + 1}: Start date must be before or the same as end date`,
            path: `/section2/edit-employment/${experience.id}?from=review`,
            targets: ["submissionReady"],
            isMissing: () => true,
          },
        ],
  );
}
