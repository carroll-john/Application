import type { ApplicationData } from "./applicationData";
import { meetsSection2SubmissionRequirement } from "./section2Requirements";

export function getNextIncompleteSection(data: ApplicationData): string | null {
  if (
    !data.personalDetails.title ||
    !data.personalDetails.firstName ||
    !data.personalDetails.lastName
  ) {
    return "Basic information";
  }

  if (
    !data.personalDetails.gender ||
    !data.personalDetails.dateOfBirth ||
    !data.personalDetails.email ||
    !data.personalDetails.phone
  ) {
    return "Personal contact details";
  }

  if (!data.contactDetails.citizenshipStatus) {
    return "Citizenship information";
  }

  if (!data.contactDetails.residentialAddress.formattedAddress) {
    return "Address details";
  }

  const meetsSection2Requirement = meetsSection2SubmissionRequirement({
    cvUploaded: data.cvUploaded,
    employmentExperiencesCount: data.employmentExperiences.length,
    tertiaryQualificationsCount: data.tertiaryQualifications.length,
  });

  if (meetsSection2Requirement) {
    return null;
  }

  if (!data.cvUploaded) return "CV upload";
  if (data.employmentExperiences.length === 0) {
    return "Employment experience";
  }

  return "Tertiary qualifications";
}
