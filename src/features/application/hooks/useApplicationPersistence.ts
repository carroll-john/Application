import { useCallback } from "react";
import {
  saveLocalActiveApplicationId,
  upsertLocalApplication,
} from "../../../lib/applicationRecords";
import type { ApplicationData } from "../../../lib/applicationData";
import { mergeStoredApplicationData } from "../../../lib/applicationData";
import type { ApplicationStorageAdapter } from "../../../lib/applicationStorageAdapter";
import type { PersistApplicationOptions } from "./applicationOrchestrationTypes";

interface UseApplicationPersistenceOptions {
  activeApplicationId: string | null;
  applicantProfileId: string | null;
  data: ApplicationData;
  setActiveApplicationId: (applicationId: string | null) => void;
  setData: (application: ApplicationData) => void;
  storageAdapter: ApplicationStorageAdapter;
  upsertSummary: (application: ApplicationData) => void;
}

export function useApplicationPersistence({
  activeApplicationId,
  applicantProfileId,
  data,
  setActiveApplicationId,
  setData,
  storageAdapter,
  upsertSummary,
}: UseApplicationPersistenceOptions) {
  const persistApplication = useCallback(
    async (nextData: ApplicationData, options?: PersistApplicationOptions) => {
      const mergedData = mergeStoredApplicationData(nextData);
      const resolvedApplicantProfileId =
        options?.applicantProfileId ??
        mergedData.applicationMeta.applicantProfileId ??
        applicantProfileId ??
        null;

      const persistedData = await storageAdapter.saveApplication(mergedData, {
        applicantProfileId: resolvedApplicantProfileId,
        forceCreate: options?.forceCreate,
      });

      upsertLocalApplication(persistedData);
      upsertSummary(persistedData);
      setData(persistedData);

      const nextActiveId =
        persistedData.applicationMeta.recordId ?? activeApplicationId;

      if (!options?.keepActive && nextActiveId) {
        setActiveApplicationId(nextActiveId);
        saveLocalActiveApplicationId(nextActiveId);
      }

      return persistedData;
    },
    [activeApplicationId, applicantProfileId, setActiveApplicationId, setData, storageAdapter, upsertSummary],
  );

  const ensureRemoteRecordId = useCallback(async () => {
    if (data.applicationMeta.recordId) {
      return data.applicationMeta.recordId;
    }

    const persisted = await persistApplication(data, { forceCreate: true });

    if (!persisted.applicationMeta.recordId) {
      throw new Error("Unable to create an application record.");
    }

    return persisted.applicationMeta.recordId;
  }, [data, persistApplication]);

  return {
    ensureRemoteRecordId,
    persistApplication,
  };
}
