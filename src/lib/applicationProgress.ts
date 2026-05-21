import type { ApplicationData, ApplicationMeta, SelectedCourse } from "./applicationData";
import { getStepCompletionSummary } from "./applicationValidationSchema";
import {
  getCourseByCode,
  getDefaultCourse,
  type CourseCatalogEntry,
} from "./courseCatalog";

export type ApplicationCourse = CourseCatalogEntry;

export function hasStartedApplication(data: ApplicationData) {
  if (isApplicationSubmitted(data)) {
    return true;
  }

  if (data.applicationMeta.recordId) {
    return true;
  }

  return Boolean(
    data.personalDetails.title ||
      data.personalDetails.firstName ||
      data.personalDetails.middleName ||
      data.personalDetails.lastName ||
      data.personalDetails.preferredName ||
      data.personalDetails.gender ||
      data.personalDetails.dateOfBirth ||
      data.personalDetails.email ||
      data.personalDetails.phone ||
      data.contactDetails.citizenCountry ||
      data.contactDetails.birthCountry ||
      data.contactDetails.citizenshipStatus ||
      data.contactDetails.residentialAddress.formattedAddress ||
      data.contactDetails.postalDifferent ||
      data.contactDetails.postalAddress.formattedAddress ||
      data.contactDetails.language ||
      data.contactDetails.aboriginal ||
      data.contactDetails.schoolLevel ||
      data.contactDetails.parentsCount ||
      data.contactDetails.parent1Details ||
      data.contactDetails.parent2Details ||
      data.contactDetails.parent3Details ||
      data.contactDetails.parent4Details ||
      data.contactDetails.parent5Details ||
      data.contactDetails.hasDisability !== null ||
      data.contactDetails.disabilityDetails ||
      data.tertiaryQualifications.length ||
      data.employmentExperiences.length ||
      data.professionalAccreditations.length ||
      data.secondaryQualifications.length ||
      data.languageTests.length ||
      data.cvUploaded,
  );
}

export function isApplicationSubmitted(data: ApplicationData) {
  return Boolean(data.applicationMeta?.submittedAt);
}

export function getSelectedCourse(meta?: ApplicationMeta): ApplicationCourse {
  const selectedCourse = meta?.selectedCourse;
  const defaultCourse = getDefaultCourse();

  if (selectedCourse?.code) {
    const matchingCourse = getCourseByCode(selectedCourse.code);

    if (matchingCourse) {
      return matchingCourse;
    }
  }

  if (!selectedCourse) {
    return defaultCourse;
  }

  return {
    ...defaultCourse,
    code: selectedCourse.code || defaultCourse.code,
    title: selectedCourse.title || defaultCourse.title,
    provider: selectedCourse.provider || defaultCourse.provider,
    intakeLabel: selectedCourse.intake || defaultCourse.intakeLabel,
  };
}

export function createSelectedCourseSeed(
  course: Pick<SelectedCourse, "code" | "title" | "provider" | "intake">,
): SelectedCourse {
  return {
    code: course.code,
    title: course.title,
    provider: course.provider,
    intake: course.intake,
  };
}

export function formatApplicationDate(isoDate?: string) {
  if (!isoDate) {
    return "";
  }

  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function getApplicationProgressSummary(data: ApplicationData) {
  return getStepCompletionSummary(data);
}
