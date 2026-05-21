import { useCallback } from "react";
import {
  clearLocalApplications,
  saveLocalActiveApplicationId,
  upsertLocalApplication,
  type ApplicationSummary,
} from "../../../lib/applicationRecords";
import {
  clearLocalApplicantProfile,
  type StoredApplicantProfile,
} from "../../../lib/applicantProfileStore";
import {
  initialApplicationData,
  type ApplicationData,
} from "../../../lib/applicationData";
import type { ApplicationStorageAdapter } from "../../../lib/applicationStorageAdapter";

interface UseApplicationLifecycleOptions {
  activeApplicationId: string | null;
  applications: ApplicationSummary[];
  data: ApplicationData;
  setActiveApplicationId: (applicationId: string | null) => void;
  setApplicantProfile: (profile: StoredApplicantProfile | null) => void;
  setApplications: (applications: ApplicationSummary[]) => void;
  setData: (application: ApplicationData) => void;
  storageAdapter: ApplicationStorageAdapter;
  trackApplicationSubmitted: (
    submittedApplication: ApplicationData,
    submissionMode: "local" | "remote",
  ) => void;
  upsertSummary: (application: ApplicationData) => void;
}

export function useApplicationLifecycle({
  activeApplicationId,
  applications,
  data,
  setActiveApplicationId,
  setApplicantProfile,
  setApplications,
  setData,
  storageAdapter,
  trackApplicationSubmitted,
  upsertSummary,
}: UseApplicationLifecycleOptions) {
  const openApplication = useCallback(
    async (applicationId: string) => {
      const application = await storageAdapter.loadApplicationById(applicationId);

      if (!application) {
        return;
      }

      setData(application);
      setActiveApplicationId(applicationId);
      saveLocalActiveApplicationId(applicationId);
      storageAdapter.syncLoadedApplication(application);
      upsertSummary(application);
    },
    [setActiveApplicationId, setData, storageAdapter, upsertSummary],
  );

  const markApplicationSubmitted = useCallback(async () => {
    const submittedApplication = await storageAdapter.submitApplication(data);

    upsertLocalApplication(submittedApplication);
    upsertSummary(submittedApplication);
    setData(submittedApplication);

    const nextActiveId =
      submittedApplication.applicationMeta.recordId ?? activeApplicationId;

    if (nextActiveId) {
      setActiveApplicationId(nextActiveId);
      saveLocalActiveApplicationId(nextActiveId);
    }

    trackApplicationSubmitted(submittedApplication, storageAdapter.mode);
  }, [
    activeApplicationId,
    data,
    setActiveApplicationId,
    setData,
    storageAdapter,
    trackApplicationSubmitted,
    upsertSummary,
  ]);

  const resetApplication = useCallback(async () => {
    await Promise.all(
      applications.map((application) =>
        storageAdapter.deleteApplication(application.id),
      ),
    );

    clearLocalApplications();
    clearLocalApplicantProfile();
    setApplications([]);
    setActiveApplicationId(null);
    setData(initialApplicationData);
    setApplicantProfile(null);
  }, [
    applications,
    setActiveApplicationId,
    setApplicantProfile,
    setApplications,
    setData,
    storageAdapter,
  ]);

  return {
    markApplicationSubmitted,
    openApplication,
    resetApplication,
  };
}
