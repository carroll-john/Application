import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StoredApplicantProfile } from "../../../lib/applicantProfileStore";
import {
  initialApplicationData,
  type ApplicationData,
  type SelectedCourse,
} from "../../../lib/applicationData";
import type { ApplicationStorageAdapter } from "../../../lib/applicationStorageAdapter";
import {
  assertCurrentApplicationOperation,
  type ApplicationOperationScope,
} from "./applicationOperationScope";
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
  operationScope: ApplicationOperationScope;
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
  operationScope,
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
  const activeIdRef = useRef(activeApplicationId);
  activeIdRef.current = activeApplicationId;
  const getActiveApplicationId = useCallback(() => activeIdRef.current, []);
  const { applications, setApplications, upsertSummary } = useApplicationSummaries();

  const [stateScope, setStateScope] = useState(operationScope);
  if (stateScope !== operationScope) {
    setStateScope(operationScope);
    setData(initialApplicationData);
    setActiveApplicationId(null);
    setApplications([]);
    setHydrationError(null);
    setIsHydrating(true);
    activeIdRef.current = null;
  }

  const { ensureApplicationRow, ensureRemoteRecordId, persistApplication } = useApplicationPersistence({
    activeApplicationId,
    operationScope,
    getActiveApplicationId,
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
    });

  const loadApplicationState = useCallback(async () => {
    const isCurrent = operationScope.beginSelection();
    if (!isCurrent()) return;
    setIsHydrating(true);

    try {
      await hydrateApplicationState({
        ensureApplicantProfile,
        isCurrent,
        setActiveApplicationId,
        setApplications,
        setData,
        storageAdapter,
      });

      if (isCurrent()) {
        setHydrationError(null);
      }
    } catch (error) {
      captureSentryException(error, {
        tags: { flow: "application_hydration" },
      });

      if (isCurrent()) {
        setHydrationError(
          "We couldn't load your application data. Try refreshing the page.",
        );
      }
    } finally {
      if (isCurrent()) {
        setIsHydrating(false);
      }
    }
  }, [operationScope, ensureApplicantProfile, setApplications, storageAdapter]);

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
    ) => {
      const isCurrent = operationScope.beginSelection();
      assertCurrentApplicationOperation(isCurrent);
      setIsHydrating(false);
      return runBeginCourseApplication(course, options, {
        applications,
        data,
        ensureApplicantProfile,
        openApplication: async (id) => {
          assertCurrentApplicationOperation(isCurrent);
          await openApplication(id);
        },
        persistApplication: async (nextData, saveOptions) => {
          assertCurrentApplicationOperation(isCurrent);
          return persistApplication(nextData, saveOptions);
        },
        storageAdapter,
        trackDraftCreated,
        trackDraftResumed,
      });
    },
    [
      operationScope,
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
