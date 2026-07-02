import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StoredApplicantProfile } from "../../../lib/applicantProfileStore";
import {
  initialApplicationData,
  type ApplicationData,
  type SelectedCourse,
} from "../../../lib/applicationData";
import type { ApplicationStorageAdapter } from "../../../lib/applicationStorageAdapter";
import { captureSentryException } from "../../../lib/sentry";
import { beginCourseApplication as runBeginCourseApplication } from "./beginCourseApplication";
import type { BeginCourseApplicationOptions } from "./applicationOrchestrationTypes";
import { hydrateApplicationState } from "./useApplicationHydration";
import { useApplicationLifecycle } from "./useApplicationLifecycle";
import { useApplicationPersistence } from "./useApplicationPersistence";
import { useApplicationSummaries } from "./useApplicationSummaries";

export type {
  BeginCourseApplicationOptions,
  PersistApplicationOptions,
} from "./applicationOrchestrationTypes";

interface UseApplicationStorageOrchestrationOptions {
  applicantProfileId: string | null;
  ensureApplicantProfile: () => Promise<StoredApplicantProfile | null>;
  setApplicantProfile: (profile: StoredApplicantProfile | null) => void;
  storageAdapter: ApplicationStorageAdapter;
  trackApplicationSubmitted: (submittedApplication: ApplicationData) => void;
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
  const [activeApplicationId, setActiveApplicationId] = useState<string | null>(
    null,
  );
  const [isHydrating, setIsHydrating] = useState(true);
  const [hydrationError, setHydrationError] = useState<string | null>(null);
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

      if (isMountedRef.current) {
        setHydrationError(null);
      }
    } catch (error) {
      captureSentryException(error, {
        tags: { flow: "application_hydration" },
      });

      if (isMountedRef.current) {
        setHydrationError(
          "We couldn't load your application data. Try refreshing the page.",
        );
      }
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
      ensureApplicationRow,
      ensureRemoteRecordId,
      hydrationError,
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
      ensureApplicationRow,
      ensureRemoteRecordId,
      hydrationError,
      isHydrating,
      markApplicationSubmitted,
      openApplication,
      persistApplication,
      refreshApplications,
      resetApplication,
    ],
  );
}
