import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clearLocalApplications,
  createApplicationDraft,
  loadLocalActiveApplicationId,
  saveLocalActiveApplicationId,
  summarizeApplication,
  upsertLocalApplication,
  type ApplicationSummary,
} from "../../lib/applicationRecords";
import {
  clearLocalApplicantProfile,
  type StoredApplicantProfile,
} from "../../lib/applicantProfileStore";
import type {
  ApplicationData,
  SelectedCourse,
} from "../../lib/applicationData";
import {
  initialApplicationData,
  mergeStoredApplicationData,
} from "../../lib/applicationData";
import type { ApplicationStorageAdapter } from "../../lib/applicationStorageAdapter";

export interface PersistApplicationOptions {
  applicantProfileId?: string | null;
  forceCreate?: boolean;
  keepActive?: boolean;
}

interface UseApplicationStorageOrchestrationOptions {
  applicantProfileId: string | null;
  ensureApplicantProfile: () => Promise<StoredApplicantProfile | null>;
  setApplicantProfile: (profile: StoredApplicantProfile | null) => void;
  storageAdapter: ApplicationStorageAdapter;
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
  const isMountedRef = useRef(true);

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
      await ensureApplicantProfile();

      if (!isMountedRef.current) {
        return;
      }

      const loadedApplications = await storageAdapter.listApplications();

      if (!isMountedRef.current) {
        return;
      }

      setApplications(loadedApplications);

      const preferredId =
        loadLocalActiveApplicationId() ??
        loadedApplications.find((application) => application.status === "draft")
          ?.id ??
        loadedApplications[0]?.id ??
        null;

      if (!preferredId) {
        setActiveApplicationId(null);
        setData(initialApplicationData);
        return;
      }

      let resolvedPreferredId = preferredId;
      let application = await storageAdapter.loadApplicationById(
        resolvedPreferredId,
      );

      if (!application) {
        const fallbackId =
          loadedApplications.find(
            (loadedApplication) => loadedApplication.id !== resolvedPreferredId,
          )?.id ?? null;

        if (!fallbackId) {
          setActiveApplicationId(null);
          setData(initialApplicationData);
          return;
        }

        resolvedPreferredId = fallbackId;
        application = await storageAdapter.loadApplicationById(resolvedPreferredId);
      }

      if (!application) {
        setActiveApplicationId(null);
        setData(initialApplicationData);
        return;
      }

      if (!isMountedRef.current) {
        return;
      }

      setActiveApplicationId(resolvedPreferredId);
      saveLocalActiveApplicationId(resolvedPreferredId);
      setData(application);
      storageAdapter.syncLoadedApplication(application);
    } finally {
      if (isMountedRef.current) {
        setIsHydrating(false);
      }
    }
  }, [ensureApplicantProfile, storageAdapter]);

  useEffect(() => {
    void loadApplicationState();
  }, [loadApplicationState]);

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

  const beginCourseApplication = useCallback(
    async (course: SelectedCourse) => {
      const resolvedApplicantProfile = await ensureApplicantProfile();
      const existingApplication = await storageAdapter.findOpenDraftForCourse(
        course.code,
        applications,
      );

      if (existingApplication?.id) {
        await openApplication(existingApplication.id);
        const reopenedApplication =
          (await storageAdapter.loadApplicationById(existingApplication.id)) ?? data;
        trackDraftResumed(course, existingApplication.id);
        return reopenedApplication;
      }

      const draft = createApplicationDraft(
        course,
        resolvedApplicantProfile?.id ?? undefined,
        resolvedApplicantProfile,
      );

      const persisted = await persistApplication(draft, {
        applicantProfileId: resolvedApplicantProfile?.id ?? null,
        forceCreate: true,
      });

      trackDraftCreated(
        course,
        resolvedApplicantProfile?.id ?? null,
        persisted.applicationMeta.recordId ?? null,
      );

      return persisted;
    },
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
      ensureRemoteRecordId,
      isHydrating,
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
      ensureRemoteRecordId,
      isHydrating,
      markApplicationSubmitted,
      openApplication,
      persistApplication,
      refreshApplications,
      resetApplication,
    ],
  );
}
