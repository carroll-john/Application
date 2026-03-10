import type {
  ApplicationData,
  ApplicationMeta,
  TertiaryQualification,
} from "./applicationData";
import type { CourseCatalogEntry } from "./courseCatalog";
import { getCourseByCode } from "./courseCatalog";
import {
  getCourseMinimumEducation,
  hasCourseExperienceAlternative,
  type CourseEducationLevel,
} from "./courseEligibility";

const LEGACY_FIELDS = [
  "CV upload or a tertiary qualification",
  "Employment experience or a tertiary qualification",
] as const;

const tertiaryQualificationRanks: Record<string, number> = {
  "Associate Degree": 2,
  "Advanced Diploma": 2,
  Bachelor: 3,
  Diploma: 2,
  "Graduate Certificate": 4,
  "Graduate Diploma": 4,
  Honours: 4,
  Masters: 5,
  PhD: 6,
};

const minimumEducationRanks: Record<CourseEducationLevel, number> = {
  "Bachelor degree": 3,
  Diploma: 2,
  Doctorate: 6,
  "High school": 1,
  "Masters degree": 5,
};

export interface Section2RequirementInput {
  cvUploaded: boolean;
  employmentExperiencesCount: number;
  secondaryQualificationsCount: number;
  selectedCourse: CourseCatalogEntry | null;
  tertiaryQualifications: TertiaryQualification[];
}

export interface Section2RequirementProfile {
  educationEvidenceLabel: string;
  minimumEducation: CourseEducationLevel;
  supportsExperienceAlternative: boolean;
  supportsSecondaryQualification: boolean;
}

function resolveSelectedCourse(
  meta?: ApplicationMeta,
): CourseCatalogEntry | null {
  return getCourseByCode(meta?.selectedCourse?.code ?? null);
}

function getLegacyMissingFields(input: Section2RequirementInput) {
  const missingFields: string[] = [];

  if (!input.cvUploaded) {
    missingFields.push(LEGACY_FIELDS[0]);
  }

  if (input.employmentExperiencesCount === 0) {
    missingFields.push(LEGACY_FIELDS[1]);
  }

  return missingFields;
}

function getRequiredEducationRank(minimumEducation: CourseEducationLevel) {
  return minimumEducationRanks[minimumEducation];
}

function getTertiaryQualificationRank(level: string) {
  return tertiaryQualificationRanks[level] ?? 0;
}

function getEducationEvidenceLabel(minimumEducation: CourseEducationLevel) {
  switch (minimumEducation) {
    case "High school":
      return "a secondary or tertiary qualification";
    case "Diploma":
      return "a diploma, associate degree, or higher qualification";
    case "Bachelor degree":
      return "a bachelor degree or higher qualification";
    case "Masters degree":
      return "a master's degree or higher qualification";
    case "Doctorate":
      return "a doctorate";
    default:
      return "a qualifying education history";
  }
}

function hasQualifyingTertiaryQualification(
  qualifications: TertiaryQualification[],
  minimumEducation: CourseEducationLevel,
) {
  if (minimumEducation === "High school") {
    return qualifications.length > 0;
  }

  const requiredRank = getRequiredEducationRank(minimumEducation);

  return qualifications.some(
    (qualification) =>
      getTertiaryQualificationRank(qualification.level) >= requiredRank,
  );
}

export function getSection2RequirementProfile(
  selectedCourse: CourseCatalogEntry | null,
): Section2RequirementProfile | null {
  if (!selectedCourse) {
    return null;
  }

  const minimumEducation = getCourseMinimumEducation(selectedCourse.eligibility);

  return {
    educationEvidenceLabel: getEducationEvidenceLabel(minimumEducation),
    minimumEducation,
    supportsExperienceAlternative: hasCourseExperienceAlternative(
      selectedCourse.eligibility,
    ),
    supportsSecondaryQualification: minimumEducation === "High school",
  };
}

export function getSection2RequirementInput(
  data: ApplicationData,
): Section2RequirementInput {
  return {
    cvUploaded: data.cvUploaded,
    employmentExperiencesCount: data.employmentExperiences.length,
    secondaryQualificationsCount: data.secondaryQualifications.length,
    selectedCourse: resolveSelectedCourse(data.applicationMeta),
    tertiaryQualifications: data.tertiaryQualifications,
  };
}

export function meetsSection2SubmissionRequirement(
  input: Section2RequirementInput,
) {
  const profile = getSection2RequirementProfile(input.selectedCourse);

  if (!profile) {
    return (
      input.tertiaryQualifications.length > 0 ||
      (input.cvUploaded && input.employmentExperiencesCount > 0)
    );
  }

  const hasEducationEvidence =
    (profile.supportsSecondaryQualification &&
      input.secondaryQualificationsCount > 0) ||
    hasQualifyingTertiaryQualification(
      input.tertiaryQualifications,
      profile.minimumEducation,
    );

  if (hasEducationEvidence) {
    return true;
  }

  return (
    profile.supportsExperienceAlternative &&
    input.cvUploaded &&
    input.employmentExperiencesCount > 0
  );
}

export function getSection2SubmissionMissingFields(
  input: Section2RequirementInput,
) {
  if (meetsSection2SubmissionRequirement(input)) {
    return [];
  }

  const profile = getSection2RequirementProfile(input.selectedCourse);

  if (!profile) {
    return getLegacyMissingFields(input);
  }

  return [
    profile.supportsExperienceAlternative
      ? `Add either ${profile.educationEvidenceLabel} or both a CV and employment experience`
      : `Add ${profile.educationEvidenceLabel}`,
  ];
}
