import type { ApplicationMeta, SelectedCourse } from "./applicationData";
import {
  getCourseByCode,
  getDefaultCourse,
  type CourseCatalogEntry,
} from "./courseCatalog";

export type ApplicationCourse = CourseCatalogEntry;

interface ApplicationProgressSnapshot {
  personalDetails: {
    title: string;
    firstName: string;
    middleName: string;
    lastName: string;
    preferredName: string;
    gender: string;
    dateOfBirth: string;
    email: string;
    phone: string;
  };
  contactDetails: {
    citizenCountry: string;
    birthCountry: string;
    citizenshipStatus: string;
    residentialAddress: { formattedAddress: string };
    postalDifferent: boolean;
    postalAddress: { formattedAddress: string };
    language: string;
    aboriginal: string;
    schoolLevel: string;
    parentsCount: string;
    parent1Details: string;
    parent2Details: string;
    parent3Details: string;
    parent4Details: string;
    parent5Details: string;
    hasDisability: boolean;
    disabilityDetails: string;
  };
  tertiaryQualifications: unknown[];
  employmentExperiences: unknown[];
  professionalAccreditations: unknown[];
  secondaryQualifications: unknown[];
  languageTests: unknown[];
  cvUploaded: boolean;
  applicationMeta?: {
    applicationNumber?: string;
    submittedAt?: string;
  };
}

export function hasStartedApplication(data: ApplicationProgressSnapshot) {
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
      data.contactDetails.hasDisability ||
      data.contactDetails.disabilityDetails ||
      data.tertiaryQualifications.length ||
      data.employmentExperiences.length ||
      data.professionalAccreditations.length ||
      data.secondaryQualifications.length ||
      data.languageTests.length ||
      data.cvUploaded,
  );
}

export function isApplicationSubmitted(data: ApplicationProgressSnapshot) {
  return Boolean(data.applicationMeta?.submittedAt);
}

export function createApplicationNumber() {
  return `QX-${Math.floor(1000000 + Math.random() * 9000000)}`;
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
