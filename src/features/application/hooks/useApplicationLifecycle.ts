import {
  assertCurrentApplicationOperation,
  type ApplicationOperationScope,
} from "./applicationOperationScope";
import { useCallback } from "react";
import {
  saveLocalActiveApplicationId,
  type ApplicationSummary,
} from "../../../lib/applicationRecords";
import type { StoredApplicantProfile } from "../../../lib/applicantProfileStore";
import {
  initialApplicationData,
  type ApplicationData,
} from "../../../lib/applicationData";
import type { ApplicationStorageAdapter } from "../../../lib/applicationStorageAdapter";

interface UseApplicationLifecycleOptions {
  activeApplicationId: string | null;
  operationScope: ApplicationOperationScope;
  getActiveApplicationId: () => string | null;
  setIsHydrating: (value: boolean) => void;
  applications: ApplicationSummary[];
  data: ApplicationData;
  setActiveApplicationId: (applicationId: string | null) => void;
  setApplicantProfile: (profile: StoredApplicantProfile | null) => void;
  setApplications: (applications: ApplicationSummary[]) => void;
  setData: (application: ApplicationData) => void;
  storageAdapter: ApplicationStorageAdapter;
  trackApplicationSubmitted: (submittedApplication: ApplicationData) => void;
  upsertSummary: (application: ApplicationData) => void;
}

export function useApplicationLifecycle({
  activeApplicationId,
  operationScope,
  getActiveApplicationId,
  setIsHydrating,
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
      const isCurrent = operationScope.beginSelection();
      assertCurrentApplicationOperation(isCurrent);
      setIsHydrating(false);
      const application = await storageAdapter.loadApplicationById(applicationId);

      if (!isCurrent() || !application) {
        return;
      }

      setData(application);
      setActiveApplicationId(applicationId);
      saveLocalActiveApplicationId(applicationId);
      upsertSummary(application);
    },
    [operationScope, setIsHydrating, setActiveApplicationId, setData, storageAdapter, upsertSummary],
  );

  const markApplicationSubmitted = useCallback(async () => {
    const isCurrentSession = operationScope.captureSession();
    const isCurrentSelection = operationScope.captureSelection();
    assertCurrentApplicationOperation(isCurrentSession);
    assertCurrentApplicationOperation(
      () => (data.applicationMeta.recordId ?? null) === getActiveApplicationId(),
    );
    const submittedApplication = await storageAdapter.submitApplication(data);

    assertCurrentApplicationOperation(isCurrentSession);
    upsertSummary(submittedApplication);
    trackApplicationSubmitted(submittedApplication);
    if (!isCurrentSelection()) return;
    setData(submittedApplication);

    const nextActiveId =
      submittedApplication.applicationMeta.recordId ?? activeApplicationId;

    if (nextActiveId) {
      setActiveApplicationId(nextActiveId);
      saveLocalActiveApplicationId(nextActiveId);
    }

  }, [
    activeApplicationId,
    operationScope,
    getActiveApplicationId,
    data,
    setActiveApplicationId,
    setData,
    storageAdapter,
    trackApplicationSubmitted,
    upsertSummary,
  ]);

  const resetApplication = useCallback(async () => {
    const isCurrent = operationScope.beginSelection();
    assertCurrentApplicationOperation(isCurrent);
    setIsHydrating(false);
    await Promise.all(
      applications.map((application) =>
        storageAdapter.deleteApplication(application.id),
      ),
    );

    if (!isCurrent()) return;
    saveLocalActiveApplicationId(null);
    setApplications([]);
    setActiveApplicationId(null);
    setData(initialApplicationData);
    setApplicantProfile(null);
  }, [
    operationScope,
    setIsHydrating,
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
