import {
  APPLICATION_STORAGE_KEY,
  clearLocalApplicationData,
  initialApplicationData,
  loadLocalApplicationData,
  mergeStoredApplicationData,
  saveLocalApplicationData,
  type ApplicationData,
  type EmploymentExperience,
  type LanguageTest,
  type ProfessionalAccreditation,
  type SecondaryQualification,
  type SelectedCourse,
  type TertiaryQualification,
} from "./applicationData";
import type { StoredApplicantProfile } from "./applicantProfileStore";
import { getStepCompletionSummary } from "./applicationValidationSchema";

export const APPLICATIONS_STORAGE_KEY = "application-prototype:applications";
export const ACTIVE_APPLICATION_ID_STORAGE_KEY =
  "application-prototype:active-application-id";

export interface ApplicationSummary {
  applicationNumber?: string;
  completedStepCount: number;
  completionPercentage: number;
  course: SelectedCourse;
  id: string;
  status: "draft" | "submitted";
  submittedAt?: string;
  totalStepCount: number;
  updatedAt: string;
}

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

export function summarizeApplication(
  application: ApplicationData,
): ApplicationSummary | null {
  const recordId = application.applicationMeta.recordId;
  const selectedCourse = application.applicationMeta.selectedCourse;

  if (!recordId || !selectedCourse) {
    return null;
  }

  const stepCompletionSummary = getStepCompletionSummary(application);

  return {
    applicationNumber: application.applicationMeta.applicationNumber,
    completedStepCount: stepCompletionSummary.completedSteps,
    completionPercentage: stepCompletionSummary.completionPercentage,
    course: selectedCourse,
    id: recordId,
    status: application.applicationMeta.submittedAt ? "submitted" : "draft",
    submittedAt: application.applicationMeta.submittedAt,
    totalStepCount: stepCompletionSummary.totalSteps,
    updatedAt:
      application.applicationMeta.updatedAt ??
      application.applicationMeta.createdAt ??
      new Date().toISOString(),
  };
}

export function sortApplicationsForPrefillChooser(
  applications: ApplicationSummary[],
  targetCourseCode: string,
  activeApplicationId?: string | null,
) {
  return applications
    .filter((application) => application.course.code !== targetCourseCode)
    .sort((left, right) => {
      if (right.completionPercentage !== left.completionPercentage) {
        return right.completionPercentage - left.completionPercentage;
      }

      if (right.completedStepCount !== left.completedStepCount) {
        return right.completedStepCount - left.completedStepCount;
      }

      const leftSubmittedRank = Number(left.status === "submitted");
      const rightSubmittedRank = Number(right.status === "submitted");

      if (rightSubmittedRank !== leftSubmittedRank) {
        return rightSubmittedRank - leftSubmittedRank;
      }

      if (left.id === activeApplicationId) {
        return -1;
      }

      if (right.id === activeApplicationId) {
        return 1;
      }

      return right.updatedAt.localeCompare(left.updatedAt);
    });
}

export function loadLocalApplications(): ApplicationData[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const storedValue = window.localStorage.getItem(APPLICATIONS_STORAGE_KEY);

    if (storedValue) {
      const parsedValue = JSON.parse(storedValue) as Partial<ApplicationData>[];

      if (Array.isArray(parsedValue)) {
        return parsedValue.map((application) =>
          mergeStoredApplicationData(application),
        );
      }
    }
  } catch {
    // Fall back to legacy storage below.
  }

  const legacyApplication = loadLocalApplicationData();
  const legacySummary = summarizeApplication(legacyApplication);

  if (!legacySummary) {
    return [];
  }

  return [legacyApplication];
}

export function saveLocalApplications(applications: ApplicationData[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      APPLICATIONS_STORAGE_KEY,
      JSON.stringify(applications),
    );
    clearLocalApplicationData();
  } catch {
    // Ignore storage failures and continue using in-memory state.
  }
}

export function clearLocalApplications() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(APPLICATIONS_STORAGE_KEY);
    window.localStorage.removeItem(ACTIVE_APPLICATION_ID_STORAGE_KEY);
    window.localStorage.removeItem(APPLICATION_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
}

export function loadLocalActiveApplicationId() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(ACTIVE_APPLICATION_ID_STORAGE_KEY);
}

export function saveLocalActiveApplicationId(applicationId?: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!applicationId) {
    window.localStorage.removeItem(ACTIVE_APPLICATION_ID_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(ACTIVE_APPLICATION_ID_STORAGE_KEY, applicationId);
}

export function findLocalApplicationById(applicationId: string) {
  return loadLocalApplications().find(
    (application) => application.applicationMeta.recordId === applicationId,
  );
}

export function findLocalOpenApplicationForCourse(courseCode: string) {
  return loadLocalApplications().find(
    (application) =>
      application.applicationMeta.selectedCourse?.code === courseCode &&
      !application.applicationMeta.submittedAt,
  );
}

export function upsertLocalApplication(data: ApplicationData) {
  const applications = loadLocalApplications();
  const now = new Date().toISOString();
  const nextData = mergeStoredApplicationData({
    ...data,
    applicationMeta: {
      ...data.applicationMeta,
      createdAt: data.applicationMeta.createdAt ?? now,
      status: data.applicationMeta.submittedAt ? "submitted" : "draft",
      updatedAt: now,
    },
  });
  const recordId = nextData.applicationMeta.recordId;

  if (!recordId) {
    return applications;
  }

  const existingIndex = applications.findIndex(
    (application) => application.applicationMeta.recordId === recordId,
  );

  if (existingIndex >= 0) {
    const nextApplications = [...applications];
    nextApplications[existingIndex] = nextData;
    saveLocalApplications(nextApplications);
    saveLocalApplicationData(nextData);
    saveLocalActiveApplicationId(recordId);
    return nextApplications;
  }

  const nextApplications = [nextData, ...applications];
  saveLocalApplications(nextApplications);
  saveLocalApplicationData(nextData);
  saveLocalActiveApplicationId(recordId);
  return nextApplications;
}
