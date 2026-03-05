import type { Session } from "@supabase/supabase-js";
import {
  findLocalApplicationById,
  findLocalOpenApplicationForCourse,
  loadLocalApplications,
  loadLocalActiveApplicationId,
  saveLocalActiveApplicationId,
  saveLocalApplications,
  summarizeApplication,
  upsertLocalApplication,
  type ApplicationSummary,
} from "./applicationRecords";
import {
  deleteRemoteApplication,
  listRemoteApplications,
  loadRemoteApplicationById,
  saveRemoteApplication,
  submitRemoteApplication,
} from "./applicationRemoteStore";
import {
  ensureApplicantProfile,
  loadApplicantProfile,
  type StoredApplicantProfile,
} from "./applicantProfileStore";
import {
  mergeStoredApplicationData,
  type ApplicationData,
} from "./applicationData";

export interface SaveApplicationOptions {
  applicantProfileId?: string | null;
  forceCreate?: boolean;
}

export interface ApplicationStorageAdapter {
  mode: "local" | "remote";
  ensureApplicantProfile: (
    fallbackEmail?: string,
  ) => Promise<StoredApplicantProfile | null>;
  loadApplicantProfile: (
    fallbackEmail?: string,
  ) => Promise<StoredApplicantProfile | null>;
  listApplications: () => Promise<ApplicationSummary[]>;
  loadApplicationById: (applicationId: string) => Promise<ApplicationData | null>;
  findOpenDraftForCourse: (
    courseCode: string,
    loadedApplications: ApplicationSummary[],
  ) => Promise<ApplicationSummary | null>;
  saveApplication: (
    data: ApplicationData,
    options?: SaveApplicationOptions,
  ) => Promise<ApplicationData>;
  submitApplication: (data: ApplicationData) => Promise<ApplicationData>;
  deleteApplication: (applicationId: string) => Promise<void>;
  syncLoadedApplication: (application: ApplicationData) => void;
}

interface CreateStorageAdapterOptions {
  mode: "local" | "remote";
  session: Session | null;
}

function listLocalApplicationSummaries() {
  return loadLocalApplications()
    .map((application) => summarizeApplication(application))
    .filter((summary): summary is ApplicationSummary => Boolean(summary))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function createLocalStorageAdapter(): ApplicationStorageAdapter {
  return {
    mode: "local",
    ensureApplicantProfile: async (fallbackEmail) =>
      ensureApplicantProfile(null, fallbackEmail),
    loadApplicantProfile: async (fallbackEmail) =>
      ensureApplicantProfile(null, fallbackEmail),
    listApplications: async () => listLocalApplicationSummaries(),
    loadApplicationById: async (applicationId) =>
      findLocalApplicationById(applicationId) ?? null,
    findOpenDraftForCourse: async (courseCode) => {
      const existingDraft = findLocalOpenApplicationForCourse(courseCode);
      return existingDraft ? summarizeApplication(existingDraft) : null;
    },
    saveApplication: async (data, options) =>
      mergeStoredApplicationData({
        ...data,
        applicationMeta: {
          ...data.applicationMeta,
          applicantProfileId:
            options?.applicantProfileId ??
            data.applicationMeta.applicantProfileId ??
            undefined,
        },
      }),
    submitApplication: async (data) => {
      const nextSubmittedAt = new Date().toISOString();

      return mergeStoredApplicationData({
        ...data,
        applicationMeta: {
          ...data.applicationMeta,
          applicationNumber:
            data.applicationMeta.applicationNumber ??
            `QX-${Math.floor(1000000 + Math.random() * 9000000)}`,
          status: "submitted",
          submittedAt: nextSubmittedAt,
          updatedAt: nextSubmittedAt,
        },
      });
    },
    deleteApplication: async (applicationId) => {
      const remainingApplications = loadLocalApplications().filter(
        (application) => application.applicationMeta.recordId !== applicationId,
      );

      saveLocalApplications(remainingApplications);

      if (loadLocalActiveApplicationId() === applicationId) {
        saveLocalActiveApplicationId(
          remainingApplications[0]?.applicationMeta.recordId ?? null,
        );
      }
    },
    syncLoadedApplication: () => {
      // Local mode already reads from local storage; no sync needed.
    },
  };
}

function createRemoteStorageAdapter(
  session: Session,
): ApplicationStorageAdapter {
  return {
    mode: "remote",
    ensureApplicantProfile: async () => ensureApplicantProfile(session),
    loadApplicantProfile: async () => loadApplicantProfile(session),
    listApplications: async () => listRemoteApplications(session),
    loadApplicationById: async (applicationId) =>
      loadRemoteApplicationById(session, applicationId),
    findOpenDraftForCourse: async (courseCode, loadedApplications) =>
      loadedApplications.find(
        (application) =>
          application.course.code === courseCode && application.status === "draft",
      ) ?? null,
    saveApplication: async (data, options) => {
      const mergedData = mergeStoredApplicationData(data);
      const saveResult = await saveRemoteApplication(session, mergedData, options);

      if (!saveResult) {
        return mergeStoredApplicationData({
          ...mergedData,
          applicationMeta: {
            ...mergedData.applicationMeta,
            applicantProfileId:
              options?.applicantProfileId ??
              mergedData.applicationMeta.applicantProfileId ??
              undefined,
          },
        });
      }

      return mergeStoredApplicationData({
        ...mergedData,
        applicationMeta: {
          ...mergedData.applicationMeta,
          applicantProfileId:
            saveResult.applicantProfileId ??
            options?.applicantProfileId ??
            mergedData.applicationMeta.applicantProfileId ??
            undefined,
          applicationNumber:
            saveResult.applicationNumber ??
            mergedData.applicationMeta.applicationNumber,
          recordId: saveResult.applicationId,
          status: saveResult.submittedAt ? "submitted" : "draft",
          submittedAt: saveResult.submittedAt ?? mergedData.applicationMeta.submittedAt,
          updatedAt: saveResult.updatedAt,
        },
      });
    },
    submitApplication: async (data) => {
      const submission = await submitRemoteApplication(session, data);

      return mergeStoredApplicationData({
        ...data,
        applicationMeta: {
          ...data.applicationMeta,
          applicationNumber: submission.applicationNumber,
          recordId: submission.applicationId,
          status: "submitted",
          submittedAt: submission.submittedAt,
          updatedAt: submission.submittedAt,
        },
      });
    },
    deleteApplication: async (applicationId) =>
      deleteRemoteApplication(session, applicationId),
    syncLoadedApplication: (application) => {
      upsertLocalApplication(application);
    },
  };
}

export function createApplicationStorageAdapter({
  mode,
  session,
}: CreateStorageAdapterOptions): ApplicationStorageAdapter {
  if (mode !== "remote") {
    return createLocalStorageAdapter();
  }

  if (!session) {
    throw new Error("Remote storage mode requires an authenticated session.");
  }

  return createRemoteStorageAdapter(session);
}
