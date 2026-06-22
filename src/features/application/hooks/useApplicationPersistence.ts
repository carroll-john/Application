import { useCallback } from "react";
import { saveLocalActiveApplicationId } from "../../../lib/applicationRecords";
import type { ApplicationData } from "../../../lib/applicationData";
import {
  isRemoteRecordId,
  mergeStoredApplicationData,
} from "../../../lib/applicationData";
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
        shellOnly: options?.shellOnly,
      });

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
    const persisted = await persistApplication(data, { forceCreate: true });
    const recordId = persisted.applicationMeta.recordId;

    if (!recordId) {
      throw new Error("Unable to create an application record.");
    }

    if (
      storageAdapter.mode === "remote" &&
      !isRemoteRecordId(recordId)
    ) {
      throw new Error("Unable to create an application record.");
    }

    return recordId;
  }, [data, persistApplication, storageAdapter.mode]);

  const ensureApplicationRow = useCallback(async () => {
    const persisted = await persistApplication(data, {
      forceCreate: true,
      shellOnly: true,
    });
    const recordId = persisted.applicationMeta.recordId;

    if (!recordId) {
      throw new Error("Unable to create an application record.");
    }

    if (
      storageAdapter.mode === "remote" &&
      !isRemoteRecordId(recordId)
    ) {
      throw new Error("Unable to create an application record.");
    }

    return recordId;
  }, [data, persistApplication, storageAdapter.mode]);

  return {
    ensureApplicationRow,
    ensureRemoteRecordId,
    persistApplication,
  };
}
