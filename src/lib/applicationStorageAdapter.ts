// Storage layer (top-down):
//
//   applicationStorageAdapter — this file. The only thing UI code talks to.
//     Routes to the remote store when an authenticated session is present,
//     and to a no-op "guest" adapter otherwise.
//   applicationRemoteStore    — Supabase CRUD + the submit RPC. The single
//                               source of truth for application data.
//   applicationRecords        — pure helpers (summaries, prefill sorting) plus
//                               the one browser-persisted value: the active
//                               application id, used to reopen the last draft.
//   applicationData           — canonical ApplicationData shape, the initial
//                               data, and the merge helper.
//
// Applications only ever exist in a signed-in account. Signed-out visitors can
// browse courses but cannot own a draft, so the guest adapter holds no data and
// rejects every write.

import type { Session } from "@supabase/supabase-js";
import type { ApplicationSummary } from "./applicationRecords";
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
  shellOnly?: boolean;
}

export interface ApplicationStorageAdapter {
  mode: "remote" | "guest";
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
}

interface CreateStorageAdapterOptions {
  session: Session | null;
}

function createGuestStorageAdapter(): ApplicationStorageAdapter {
  // Every application write path is gated behind authentication (route guards
  // plus the apply/eligibility flows), so these writes should never run. They
  // fail loudly if they ever do; the reads simply report "nothing here".
  const requireAuth = (): never => {
    throw new Error("Applications require an authenticated session.");
  };

  return {
    mode: "guest",
    ensureApplicantProfile: async () => null,
    loadApplicantProfile: async () => null,
    listApplications: async () => [],
    loadApplicationById: async () => null,
    findOpenDraftForCourse: async () => null,
    saveApplication: async () => requireAuth(),
    submitApplication: async () => requireAuth(),
    deleteApplication: async () => {
      // Nothing is stored for signed-out visitors.
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
  };
}

export function createApplicationStorageAdapter({
  session,
}: CreateStorageAdapterOptions): ApplicationStorageAdapter {
  return session
    ? createRemoteStorageAdapter(session)
    : createGuestStorageAdapter();
}
