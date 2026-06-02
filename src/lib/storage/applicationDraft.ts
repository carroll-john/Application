import {
  initialApplicationData,
  type ApplicationData,
  type EmploymentExperience,
  type LanguageTest,
  type ProfessionalAccreditation,
  type SecondaryQualification,
  type SelectedCourse,
  type TertiaryQualification,
} from "../applicationData";
import type { StoredApplicantProfile } from "../applicantProfileStore";

/** Builds a fresh application draft, optionally prefilled from a prior application. */

interface CreateApplicationDraftOptions {
  includeSourceDocuments?: boolean;
}

function createLocalApplicationId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `local-${crypto.randomUUID()}`;
  }

  return `local-${Date.now()}`;
}

function createDraftItemId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cloneEmploymentExperiences(
  experiences: EmploymentExperience[],
): EmploymentExperience[] {
  return experiences.map((experience) => ({
    ...experience,
    id: createDraftItemId("employment"),
  }));
}

function cloneTertiaryQualifications(
  qualifications: TertiaryQualification[],
  includeDocuments: boolean,
): TertiaryQualification[] {
  return qualifications.map((qualification) => ({
    ...qualification,
    id: createDraftItemId("tertiary"),
    certificateDocument: includeDocuments
      ? qualification.certificateDocument
      : undefined,
    transcriptDocument: includeDocuments
      ? qualification.transcriptDocument
      : undefined,
  }));
}

function cloneProfessionalAccreditations(
  accreditations: ProfessionalAccreditation[],
  includeDocuments: boolean,
): ProfessionalAccreditation[] {
  return accreditations.map((accreditation) => ({
    ...accreditation,
    document: includeDocuments ? accreditation.document : undefined,
    id: createDraftItemId("accreditation"),
  }));
}

function cloneSecondaryQualifications(
  qualifications: SecondaryQualification[],
): SecondaryQualification[] {
  return qualifications.map((qualification) => ({
    ...qualification,
    id: createDraftItemId("secondary"),
  }));
}

function cloneLanguageTests(
  tests: LanguageTest[],
  includeDocuments: boolean,
): LanguageTest[] {
  return tests.map((test) => ({
    ...test,
    document: includeDocuments ? test.document : undefined,
    id: createDraftItemId("language-test"),
  }));
}

function buildSeededPersonalDetails(
  applicantProfile?: StoredApplicantProfile | null,
  sourceApplication?: ApplicationData | null,
) {
  const sourcePersonalDetails = sourceApplication?.personalDetails;

  return {
    ...initialApplicationData.personalDetails,
    ...sourcePersonalDetails,
    email: applicantProfile?.email ?? sourcePersonalDetails?.email ?? "",
    firstName:
      applicantProfile?.firstName ?? sourcePersonalDetails?.firstName ?? "",
    lastName: applicantProfile?.lastName ?? sourcePersonalDetails?.lastName ?? "",
  };
}

function buildSeededContactDetails(sourceApplication?: ApplicationData | null) {
  const sourceContactDetails = sourceApplication?.contactDetails;

  return {
    ...initialApplicationData.contactDetails,
    ...sourceContactDetails,
    postalAddress: {
      ...initialApplicationData.contactDetails.postalAddress,
      ...sourceContactDetails?.postalAddress,
    },
    residentialAddress: {
      ...initialApplicationData.contactDetails.residentialAddress,
      ...sourceContactDetails?.residentialAddress,
    },
  };
}

function buildPrefillSource(sourceApplication?: ApplicationData | null) {
  const sourceApplicationId = sourceApplication?.applicationMeta.recordId;
  const sourceCourse = sourceApplication?.applicationMeta.selectedCourse;

  if (!sourceApplicationId || !sourceCourse) {
    return undefined;
  }

  return {
    applicationId: sourceApplicationId,
    course: sourceCourse,
  };
}

export function createApplicationDraft(
  course: SelectedCourse,
  applicantProfileId?: string,
  applicantProfile?: StoredApplicantProfile | null,
  sourceApplication?: ApplicationData | null,
  options: CreateApplicationDraftOptions = {},
): ApplicationData {
  const now = new Date().toISOString();
  const hasSourceApplication = Boolean(sourceApplication);
  const includeSourceDocuments =
    options.includeSourceDocuments ?? hasSourceApplication;

  return {
    ...initialApplicationData,
    applicationMeta: {
      applicantProfileId,
      createdAt: now,
      prefilledFrom: buildPrefillSource(sourceApplication),
      recordId: createLocalApplicationId(),
      selectedCourse: course,
      status: "draft",
      updatedAt: now,
    },
    contactDetails: buildSeededContactDetails(sourceApplication),
    cvDocument: includeSourceDocuments ? sourceApplication?.cvDocument : undefined,
    cvFileName: sourceApplication?.cvFileName,
    cvUploaded: Boolean(
      sourceApplication?.cvUploaded ||
        sourceApplication?.cvFileName ||
        sourceApplication?.cvDocument,
    ),
    employmentExperiences: cloneEmploymentExperiences(
      sourceApplication?.employmentExperiences ?? [],
    ),
    languageTests: cloneLanguageTests(
      sourceApplication?.languageTests ?? [],
      includeSourceDocuments,
    ),
    personalDetails: buildSeededPersonalDetails(
      applicantProfile,
      sourceApplication,
    ),
    professionalAccreditations: cloneProfessionalAccreditations(
      sourceApplication?.professionalAccreditations ?? [],
      includeSourceDocuments,
    ),
    secondaryQualifications: cloneSecondaryQualifications(
      sourceApplication?.secondaryQualifications ?? [],
    ),
    tertiaryQualifications: cloneTertiaryQualifications(
      sourceApplication?.tertiaryQualifications ?? [],
      includeSourceDocuments,
    ),
  };
}
