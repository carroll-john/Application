import { useCallback, useEffect, useState } from "react";
import {
  loadLocalApplications,
  saveLocalApplications,
  type ApplicationSummary,
} from "../../../lib/applicationRecords";
import type { ApplicationData } from "../../../lib/applicationData";
import { mergeStoredApplicationData } from "../../../lib/applicationData";
import type { ApplicationStorageAdapter } from "../../../lib/applicationStorageAdapter";
import { capturePostHogEvent } from "../../../lib/posthog";
import { cloneSourceApplicationDocuments } from "./applicationDocumentClone";
import type { PersistApplicationOptions } from "./useApplicationStorageOrchestration";

export interface LocalDraftImportState {
  error?: string;
  failedCount: number;
  importedCount: number;
  localDraftCount: number;
  skippedCount: number;
  status: "idle" | "ready" | "importing" | "completed";
}

interface UseApplicationDraftImportOptions {
  applicantProfileId: string | null;
  applications: ApplicationSummary[];
  importOwnerId?: string | null;
  isHydrating: boolean;
  persistApplication: (
    nextData: ApplicationData,
    options?: PersistApplicationOptions,
  ) => Promise<ApplicationData>;
  refreshApplications: () => Promise<void>;
  storageAdapter: ApplicationStorageAdapter;
  upsertSummary: (application: ApplicationData) => void;
}

function getLocalDrafts() {
  return loadLocalApplications().filter(
    (application) =>
      application.applicationMeta.recordId?.startsWith("local-") &&
      !application.applicationMeta.submittedAt,
  );
}

export function useApplicationDraftImport({
  applicantProfileId,
  applications,
  importOwnerId,
  isHydrating,
  persistApplication,
  refreshApplications,
  storageAdapter,
  upsertSummary,
}: UseApplicationDraftImportOptions) {
  const [localDraftImport, setLocalDraftImport] =
    useState<LocalDraftImportState>({
      failedCount: 0,
      importedCount: 0,
      localDraftCount: 0,
      skippedCount: 0,
      status: "idle",
    });
  const importDismissalKey = importOwnerId
    ? `application-prototype:local-draft-import-dismissed:${importOwnerId}`
    : null;

  useEffect(() => {
    if (
      storageAdapter.mode !== "remote" ||
      isHydrating ||
      localDraftImport.status === "importing" ||
      localDraftImport.status === "completed"
    ) {
      return;
    }

    if (
      importDismissalKey &&
      window.localStorage.getItem(importDismissalKey) === "1"
    ) {
      return;
    }

    const localDrafts = getLocalDrafts();

    if (localDrafts.length === 0) {
      setLocalDraftImport((previous) =>
        previous.status === "idle"
          ? previous
          : {
              failedCount: 0,
              importedCount: 0,
              localDraftCount: 0,
              skippedCount: 0,
              status: "idle",
            },
      );
      return;
    }

    setLocalDraftImport((previous) =>
      previous.status === "ready" &&
      previous.localDraftCount === localDrafts.length
        ? previous
        : {
            failedCount: 0,
            importedCount: 0,
            localDraftCount: localDrafts.length,
            skippedCount: 0,
            status: "ready",
          },
    );
  }, [
    importDismissalKey,
    isHydrating,
    localDraftImport.status,
    storageAdapter.mode,
  ]);

  const dismissLocalDraftImport = useCallback(() => {
    if (importDismissalKey) {
      window.localStorage.setItem(importDismissalKey, "1");
    }

    setLocalDraftImport((previous) => ({
      ...previous,
      status: "idle",
    }));
  }, [importDismissalKey]);

  const importLocalDrafts = useCallback(async () => {
    if (storageAdapter.mode !== "remote") {
      return;
    }

    const localDrafts = getLocalDrafts();

    if (localDrafts.length === 0) {
      setLocalDraftImport({
        failedCount: 0,
        importedCount: 0,
        localDraftCount: 0,
        skippedCount: 0,
        status: "idle",
      });
      return;
    }

    setLocalDraftImport({
      failedCount: 0,
      importedCount: 0,
      localDraftCount: localDrafts.length,
      skippedCount: 0,
      status: "importing",
    });
    capturePostHogEvent("local_draft_import_started", {
      local_draft_count: localDrafts.length,
    });

    let importedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const importedLocalIds = new Set<string>();
    const remoteDraftCourseCodes = new Set(
      applications
        .filter((application) => application.status === "draft")
        .map((application) => application.course.code),
    );

    for (const localDraft of localDrafts) {
      const localId = localDraft.applicationMeta.recordId;
      const selectedCourse = localDraft.applicationMeta.selectedCourse;

      if (!localId || !selectedCourse) {
        failedCount += 1;
        continue;
      }

      if (remoteDraftCourseCodes.has(selectedCourse.code)) {
        skippedCount += 1;
        continue;
      }

      try {
        const remoteSeed = mergeStoredApplicationData({
          ...localDraft,
          applicationMeta: {
            ...localDraft.applicationMeta,
            applicantProfileId: applicantProfileId ?? undefined,
            applicationNumber: undefined,
            recordId: undefined,
            status: "draft",
            submittedAt: undefined,
          },
        });
        let persisted = await persistApplication(remoteSeed, {
          applicantProfileId,
          forceCreate: true,
          keepActive: true,
        });

        const clonedApplication = await cloneSourceApplicationDocuments(
          persisted,
          localDraft,
        );

        persisted = await persistApplication(clonedApplication, {
          applicantProfileId,
          keepActive: true,
        });

        importedLocalIds.add(localId);
        remoteDraftCourseCodes.add(selectedCourse.code);
        importedCount += 1;
        upsertSummary(persisted);
      } catch {
        failedCount += 1;
      }
    }

    const remainingLocalApplications = loadLocalApplications().filter(
      (application) =>
        !application.applicationMeta.recordId ||
        !importedLocalIds.has(application.applicationMeta.recordId),
    );
    saveLocalApplications(remainingLocalApplications);
    await refreshApplications();

    const nextState: LocalDraftImportState = {
      failedCount,
      importedCount,
      localDraftCount: localDrafts.length,
      skippedCount,
      status: "completed",
    };

    if (failedCount > 0) {
      nextState.error =
        "Some local drafts could not be imported. They are still saved on this device.";
      capturePostHogEvent("local_draft_import_failed", {
        failed_count: failedCount,
        imported_count: importedCount,
        skipped_count: skippedCount,
      });
    } else {
      capturePostHogEvent("local_draft_import_completed", {
        imported_count: importedCount,
        skipped_count: skippedCount,
      });
    }

    setLocalDraftImport(nextState);
  }, [
    applicantProfileId,
    applications,
    persistApplication,
    refreshApplications,
    storageAdapter.mode,
    upsertSummary,
  ]);

  return {
    dismissLocalDraftImport,
    importLocalDrafts,
    localDraftImport,
  };
}
