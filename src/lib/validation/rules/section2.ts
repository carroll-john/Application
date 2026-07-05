import type {
  ApplicationData,
  EmploymentExperience,
  TertiaryQualification,
} from "../../applicationData";
import { isSubmissionReadyDocument } from "../../documentAttachment";
import { needsCertificateOfCompletion } from "../../eligibility/englishProficiencyEvidence";
import { getBlockingProgramEvidenceRows } from "../../eligibility/programEvidence";
import type { TranscriptEligibilityAssessment } from "../../eligibility/types";
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
    // Optional hard requirement: only when the qualification is marked completed but
    // its transcript can't evidence that completion (and no certificate is attached).
    field: "Certificate of Completion",
    isMissing: (qualification) =>
      needsCertificateOfCompletion(qualification) &&
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

interface EmploymentFieldRule {
  field: string;
  isMissing: (experience: EmploymentExperience) => boolean;
}

const employmentFieldRules: EmploymentFieldRule[] = [
  {
    field: "Company/Organization",
    isMissing: (experience) => !experience.company.trim(),
  },
  {
    field: "Position/Role",
    isMissing: (experience) => !experience.position.trim(),
  },
  {
    field: "Employment type",
    isMissing: (experience) => !experience.type,
  },
  {
    field: "Start date",
    isMissing: (experience) => !experience.startMonth || !experience.startYear,
  },
  {
    field: "End date",
    isMissing: (experience) =>
      !experience.currentRole && (!experience.endMonth || !experience.endYear),
  },
  {
    field: "Start date must be before or the same as end date",
    isMissing: (experience) =>
      !experience.currentRole &&
      isMonthYearRangeOutOfOrder(
        experience.startMonth,
        experience.startYear,
        experience.endMonth,
        experience.endYear,
      ),
  },
  {
    field: "Key duties",
    isMissing: (experience) => !experience.duties.trim(),
  },
];

export function getEmploymentExperienceSubmissionMissingFields(
  experience: EmploymentExperience,
) {
  return employmentFieldRules
    .filter((rule) => rule.isMissing(experience))
    .map((rule) => rule.field);
}

export function isEmploymentExperienceSubmissionReady(
  experience: EmploymentExperience,
) {
  return getEmploymentExperienceSubmissionMissingFields(experience).length === 0;
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

function getLatestTranscriptAssessment(
  assessments: Array<TranscriptEligibilityAssessment | undefined>,
) {
  const available = assessments.filter(Boolean) as TranscriptEligibilityAssessment[];
  if (available.length === 0) {
    return undefined;
  }

  return [...available].sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))[0];
}

export function getProgramEvidenceRules(data: ApplicationData): ValidationRule[] {
  const { selectedCourse } = getSection2RequirementInput(data);
  const latestTranscriptAssessment = getLatestTranscriptAssessment(
    data.tertiaryQualifications.map((qualification) => qualification.transcriptEligibility),
  );
  const blockingRows = getBlockingProgramEvidenceRows({
    applicationData: data,
    course: selectedCourse,
    transcriptAssessment: latestTranscriptAssessment,
  });

  return blockingRows.map((row) => ({
      section: SECTION_2,
      subsection: "Program evidence",
      field: row.sourceText,
      path: row.actionPath ?? "/section2/qualifications?from=review",
      targets: ["submissionReady"],
      isMissing: () => true,
    }));
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
    getEmploymentExperienceSubmissionMissingFields(experience).map((field) => ({
      section: SECTION_2,
      subsection: "Employment experience",
      field: `Employment ${index + 1}: ${field}`,
      path: `/section2/edit-employment/${experience.id}?from=review`,
      targets: ["submissionReady"],
      isMissing: () => true,
    })),
  );
}
