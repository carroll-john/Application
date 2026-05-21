import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clearLocalApplications,
  loadLocalApplications,
  saveLocalActiveApplicationId,
  saveLocalApplications,
  summarizeApplication,
  upsertLocalApplication,
  type ApplicationSummary,
} from "../../../lib/applicationRecords";
import {
  clearLocalApplicantProfile,
  type StoredApplicantProfile,
} from "../../../lib/applicantProfileStore";
import type {
  ApplicationData,
  SelectedCourse,
} from "../../../lib/applicationData";
import {
  initialApplicationData,
  mergeStoredApplicationData,
} from "../../../lib/applicationData";
import type { ApplicationStorageAdapter } from "../../../lib/applicationStorageAdapter";
import { capturePostHogEvent } from "../../../lib/posthog";
import { cloneSourceApplicationDocuments } from "./applicationDocumentClone";
import { beginCourseApplication as runBeginCourseApplication } from "./beginCourseApplication";
import { hydrateApplicationState } from "./useApplicationHydration";

export interface PersistApplicationOptions {
  applicantProfileId?: string | null;
  forceCreate?: boolean;
  keepActive?: boolean;
}

export interface BeginCourseApplicationOptions {
  prefillFromApplicationId?: string | null;
  startFresh?: boolean;
}

export interface LocalDraftImportState {
  error?: string;
  failedCount: number;
  importedCount: number;
  localDraftCount: number;
  skippedCount: number;
  status: "idle" | "ready" | "importing" | "completed";
}

interface UseApplicationStorageOrchestrationOptions {
  applicantProfileId: string | null;
  ensureApplicantProfile: () => Promise<StoredApplicantProfile | null>;
  setApplicantProfile: (profile: StoredApplicantProfile | null) => void;
  storageAdapter: ApplicationStorageAdapter;
  importOwnerId?: string | null;
  trackApplicationSubmitted: (
    submittedApplication: ApplicationData,
    submissionMode: "local" | "remote",
  ) => void;
  trackDraftCreated: (
    course: SelectedCourse,
    applicantProfileId: string | null,
    applicationId: string | null,
  ) => void;
  trackDraftResumed: (course: SelectedCourse, applicationId: string) => void;
}

export function useApplicationStorageOrchestration({
  applicantProfileId,
  ensureApplicantProfile,
  setApplicantProfile,
  storageAdapter,
  importOwnerId,
  trackApplicationSubmitted,
  trackDraftCreated,
  trackDraftResumed,
}: UseApplicationStorageOrchestrationOptions) {
  const [data, setData] = useState<ApplicationData>(initialApplicationData);
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [activeApplicationId, setActiveApplicationId] = useState<string | null>(
    null,
  );
  const [isHydrating, setIsHydrating] = useState(true);
  const [localDraftImport, setLocalDraftImport] =
    useState<LocalDraftImportState>({
      failedCount: 0,
      importedCount: 0,
      localDraftCount: 0,
      skippedCount: 0,
      status: "idle",
    });
  const isMountedRef = useRef(true);
  const importDismissalKey = importOwnerId
    ? `application-prototype:local-draft-import-dismissed:${importOwnerId}`
    : null;

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const upsertSummary = useCallback((application: ApplicationData) => {
    const summary = summarizeApplication(application);

    if (!summary) {
      return;
    }

    setApplications((previous) => {
      const next = previous.filter((item) => item.id !== summary.id);
      return [summary, ...next].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      );
    });
  }, []);

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
    [activeApplicationId, applicantProfileId, storageAdapter, upsertSummary],
  );

  const loadApplicationState = useCallback(async () => {
    setIsHydrating(true);

    try {
      await hydrateApplicationState({
        ensureApplicantProfile,
        isMounted: () => isMountedRef.current,
        setActiveApplicationId,
        setApplications,
        setData,
        storageAdapter,
      });
    } finally {
      if (isMountedRef.current) {
        setIsHydrating(false);
      }
    }
  }, [ensureApplicantProfile, storageAdapter]);

  useEffect(() => {
    void loadApplicationState();
  }, [loadApplicationState]);

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

    const localDrafts = loadLocalApplications().filter(
      (application) =>
        application.applicationMeta.recordId?.startsWith("local-") &&
        !application.applicationMeta.submittedAt,
    );

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
    [storageAdapter, upsertSummary],
  );

  const refreshApplications = useCallback(async () => {
    await loadApplicationState();
  }, [loadApplicationState]);

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

    const localDrafts = loadLocalApplications().filter(
      (application) =>
        application.applicationMeta.recordId?.startsWith("local-") &&
        !application.applicationMeta.submittedAt,
    );

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

  const beginCourseApplication = useCallback(
    async (
      course: SelectedCourse,
      options?: BeginCourseApplicationOptions,
    ) =>
      runBeginCourseApplication(course, options, {
        applications,
        data,
        ensureApplicantProfile,
        openApplication,
        persistApplication,
        storageAdapter,
        trackDraftCreated,
        trackDraftResumed,
      }),
    [
      applications,
      data,
      ensureApplicantProfile,
      openApplication,
      persistApplication,
      storageAdapter,
      trackDraftCreated,
      trackDraftResumed,
    ],
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
  }, [applications, setApplicantProfile, storageAdapter]);

  return useMemo(
    () => ({
      activeApplicationId,
      applications,
      beginCourseApplication,
      data,
      dismissLocalDraftImport,
      ensureRemoteRecordId,
      importLocalDrafts,
      isHydrating,
      localDraftImport,
      markApplicationSubmitted,
      openApplication,
      persistApplication,
      refreshApplications,
      resetApplication,
    }),
    [
      activeApplicationId,
      applications,
      beginCourseApplication,
      data,
      dismissLocalDraftImport,
      ensureRemoteRecordId,
      importLocalDrafts,
      isHydrating,
      localDraftImport,
      markApplicationSubmitted,
      openApplication,
      persistApplication,
      refreshApplications,
      resetApplication,
    ],
  );
}
