import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StoredApplicantProfile } from "../../../lib/applicantProfileStore";
import {
  initialApplicationData,
  type ApplicationData,
  type SelectedCourse,
} from "../../../lib/applicationData";
import type { ApplicationStorageAdapter } from "../../../lib/applicationStorageAdapter";
import { beginCourseApplication as runBeginCourseApplication } from "./beginCourseApplication";
import type { BeginCourseApplicationOptions } from "./applicationOrchestrationTypes";
import { useApplicationDraftImport, type LocalDraftImportState } from "./useApplicationDraftImport";
import { hydrateApplicationState } from "./useApplicationHydration";
import { useApplicationLifecycle } from "./useApplicationLifecycle";
import { useApplicationPersistence } from "./useApplicationPersistence";
import { useApplicationSummaries } from "./useApplicationSummaries";

export type {
  BeginCourseApplicationOptions,
  PersistApplicationOptions,
} from "./applicationOrchestrationTypes";
export type { LocalDraftImportState };

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
  const [activeApplicationId, setActiveApplicationId] = useState<string | null>(
    null,
  );
  const [isHydrating, setIsHydrating] = useState(true);
  const isMountedRef = useRef(true);
  const { applications, setApplications, upsertSummary } = useApplicationSummaries();

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const { ensureApplicationRow, ensureRemoteRecordId, persistApplication } = useApplicationPersistence({
    activeApplicationId,
    applicantProfileId,
    data,
    setActiveApplicationId,
    setData,
    storageAdapter,
    upsertSummary,
  });

  const { markApplicationSubmitted, openApplication, resetApplication } =
    useApplicationLifecycle({
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
    });

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
  }, [ensureApplicantProfile, setApplications, storageAdapter]);

  useEffect(() => {
    void loadApplicationState();
  }, [loadApplicationState]);

  const refreshApplications = useCallback(async () => {
    await loadApplicationState();
  }, [loadApplicationState]);

  const { dismissLocalDraftImport, importLocalDrafts, localDraftImport } =
    useApplicationDraftImport({
      applicantProfileId,
      applications,
      importOwnerId,
      isHydrating,
      persistApplication,
      refreshApplications,
      storageAdapter,
      upsertSummary,
    });

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

  return useMemo(
    () => ({
      activeApplicationId,
      applications,
      beginCourseApplication,
      data,
      dismissLocalDraftImport,
      ensureApplicationRow,
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
      ensureApplicationRow,
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
