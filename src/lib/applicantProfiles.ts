import type { ApplicationData } from "./applicationData";

export interface ApplicantProfileSeed {
  email: string;
  firstName: string;
  lastName: string;
  preferredName: string;
  phone: string;
}

export function hasApplicantProfile(
  application: ApplicationData,
): boolean {
  const profile = deriveApplicantProfileSeed(application);

  return Boolean(profile?.email && profile.firstName && profile.lastName);
}

export function getApplicantDisplayName(application: ApplicationData): string {
  const preferredName = application.personalDetails.preferredName.trim();

  if (preferredName) {
    return preferredName;
  }

  const fullName = [
    application.personalDetails.firstName.trim(),
    application.personalDetails.lastName.trim(),
  ]
    .filter(Boolean)
    .join(" ");

  if (fullName) {
    return fullName;
  }

  return application.personalDetails.email.trim() || "Applicant";
}

export function deriveApplicantProfileSeed(
  application: ApplicationData,
): ApplicantProfileSeed | null {
  const email = application.personalDetails.email.trim().toLowerCase();

  if (!email) {
    return null;
  }

  return {
    email,
    firstName: application.personalDetails.firstName.trim(),
    lastName: application.personalDetails.lastName.trim(),
    preferredName: application.personalDetails.preferredName.trim(),
    phone: application.personalDetails.phone.trim(),
  };
}
