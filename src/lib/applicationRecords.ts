import {
  APPLICATION_STORAGE_KEY,
  clearLocalApplicationData,
  initialApplicationData,
  loadLocalApplicationData,
  mergeStoredApplicationData,
  saveLocalApplicationData,
  type ApplicationData,
  type SelectedCourse,
} from "./applicationData";
import type { StoredApplicantProfile } from "./applicantProfileStore";

export const APPLICATIONS_STORAGE_KEY = "application-prototype:applications";
export const ACTIVE_APPLICATION_ID_STORAGE_KEY =
  "application-prototype:active-application-id";

export interface ApplicationSummary {
  applicationNumber?: string;
  course: SelectedCourse;
  id: string;
  status: "draft" | "submitted";
  submittedAt?: string;
  updatedAt: string;
}

function createLocalApplicationId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `local-${crypto.randomUUID()}`;
  }

  return `local-${Date.now()}`;
}

export function createApplicationDraft(
  course: SelectedCourse,
  applicantProfileId?: string,
  applicantProfile?: StoredApplicantProfile | null,
): ApplicationData {
  const now = new Date().toISOString();

  return {
    ...initialApplicationData,
    applicationMeta: {
      applicantProfileId,
      createdAt: now,
      recordId: createLocalApplicationId(),
      selectedCourse: course,
      status: "draft",
      updatedAt: now,
    },
    personalDetails: {
      ...initialApplicationData.personalDetails,
      email: applicantProfile?.email ?? "",
      firstName: applicantProfile?.firstName ?? "",
      lastName: applicantProfile?.lastName ?? "",
      phone: applicantProfile?.phone ?? "",
      preferredName: applicantProfile?.preferredName ?? "",
    },
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

  return {
    applicationNumber: application.applicationMeta.applicationNumber,
    course: selectedCourse,
    id: recordId,
    status: application.applicationMeta.submittedAt ? "submitted" : "draft",
    submittedAt: application.applicationMeta.submittedAt,
    updatedAt:
      application.applicationMeta.updatedAt ??
      application.applicationMeta.createdAt ??
      new Date().toISOString(),
  };
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
