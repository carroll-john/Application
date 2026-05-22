import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NavigateFunction } from "react-router-dom";
import type { ApplicationSummary } from "../../lib/applicationRecords";
import type { ApplicationData, SelectedCourse } from "../../lib/applicationData";
import type { CourseCatalogEntry } from "../../lib/courseCatalog";
import {
  capturePostHogEvent,
  getCourseAnalyticsProperties,
} from "../../lib/posthog";
import { sortApplicationsForPrefillChooser } from "../../lib/applicationRecords";
import type { StartApplicationOptions } from "./EligibilityResultModal";

export type AuthGateContext = "apply" | "eligibility";

export type BeginCourseApplication = (
  course: SelectedCourse,
  options?: StartApplicationOptions,
) => Promise<ApplicationData>;

export function useCourseApplicationStart({
  activeApplicationId,
  applications,
  beginCourseApplication,
  course,
  isAuthenticated,
  isHydrating,
  navigate,
  onEligibleResult,
  onAuthRequired,
  onResetEligibilityState,
  selectedCourse,
  shouldAutoApply,
}: {
  activeApplicationId: string | null;
  applications: ApplicationSummary[];
  beginCourseApplication: BeginCourseApplication;
  course: CourseCatalogEntry;
  isAuthenticated: boolean;
  isHydrating: boolean;
  navigate: NavigateFunction;
  onEligibleResult: (reason: string) => void;
  onAuthRequired: (context: AuthGateContext) => void;
  onResetEligibilityState: () => void;
  selectedCourse: SelectedCourse;
  shouldAutoApply: boolean;
}) {
  const [applyError, setApplyError] = useState<string | null>(null);
  const [isStartingApplication, setIsStartingApplication] = useState(false);
  const [showApplicationStartPicker, setShowApplicationStartPicker] =
    useState(false);
  const autoApplyStartedRef = useRef(false);
  const currentCourseDraft = useMemo(
    () =>
      applications.find(
        (application) =>
          application.course.code === course.code && application.status === "draft",
      ) ?? null,
    [applications, course.code],
  );
  const reusableSourceApplications = useMemo(
    () =>
      sortApplicationsForPrefillChooser(
        applications,
        course.code,
        activeApplicationId,
      ),
    [activeApplicationId, applications, course.code],
  );
  const isApplyActionPending = isHydrating || isStartingApplication;

  const resetApplicationStartState = useCallback(() => {
    setApplyError(null);
    setShowApplicationStartPicker(false);
  }, []);

  const startApplication = useCallback(
    async (options?: StartApplicationOptions) => {
      setApplyError(null);
      setIsStartingApplication(true);

      try {
        await beginCourseApplication(selectedCourse, options);
        resetApplicationStartState();
        onResetEligibilityState();
        navigate(
          options?.prefillFromApplicationId && !options.startFresh
            ? "/review"
            : "/overview",
        );
      } catch (error) {
        console.error("Failed to start application", error);
        setApplyError(
          "We couldn't start your application right now. Try again.",
        );
      } finally {
        setIsStartingApplication(false);
      }
    },
    [
      beginCourseApplication,
      navigate,
      onResetEligibilityState,
      resetApplicationStartState,
      selectedCourse,
    ],
  );

  const handleEligibleApplyNow = useCallback(async () => {
    if (isApplyActionPending) {
      return;
    }

    setApplyError(null);

    if (isAuthenticated) {
      capturePostHogEvent("application_start_requested", {
        ...getCourseAnalyticsProperties(course),
        auth_state: "authenticated",
        available_prefill_sources: reusableSourceApplications.length,
      });

      if (currentCourseDraft) {
        await startApplication();
        return;
      }

      if (reusableSourceApplications.length > 0) {
        setShowApplicationStartPicker(true);
        return;
      }

      await startApplication({ startFresh: true });
      return;
    }

    capturePostHogEvent("application_sign_in_redirected", {
      ...getCourseAnalyticsProperties(course),
      auth_state: "anonymous",
      redirect_reason: "eligible_apply",
    });
    onAuthRequired("apply");
  }, [
    course,
    currentCourseDraft,
    isApplyActionPending,
    isAuthenticated,
    onAuthRequired,
    reusableSourceApplications.length,
    startApplication,
  ]);

  useEffect(() => {
    if (!shouldAutoApply || !isAuthenticated || isHydrating || autoApplyStartedRef.current) {
      return;
    }

    autoApplyStartedRef.current = true;

    if (currentCourseDraft) {
      void beginCourseApplication(selectedCourse)
        .then(() => {
          navigate("/overview", { replace: true });
        })
        .catch((error) => {
          console.error("Failed to auto-start existing draft", error);
          autoApplyStartedRef.current = false;
          onEligibleResult(`You meet the entry criteria for ${course.title}.`);
          setApplyError(
            "We couldn't start your application right now. Try again.",
          );
        });
      return;
    }

    if (reusableSourceApplications.length > 0) {
      onEligibleResult(`You meet the entry criteria for ${course.title}.`);
      setShowApplicationStartPicker(true);
      return;
    }

    void beginCourseApplication(selectedCourse, { startFresh: true })
      .then(() => {
        navigate("/overview", { replace: true });
      })
      .catch((error) => {
        console.error("Failed to auto-start fresh application", error);
        autoApplyStartedRef.current = false;
        onEligibleResult(`You meet the entry criteria for ${course.title}.`);
        setApplyError(
          "We couldn't start your application right now. Try again.",
        );
      });
  }, [
    beginCourseApplication,
    course.title,
    currentCourseDraft,
    isAuthenticated,
    isHydrating,
    navigate,
    onEligibleResult,
    reusableSourceApplications.length,
    selectedCourse,
    shouldAutoApply,
  ]);

  return {
    applyError,
    currentCourseDraft,
    handleEligibleApplyNow,
    isApplyActionPending,
    resetApplicationStartState,
    reusableSourceApplications,
    setApplyError,
    setShowApplicationStartPicker,
    showApplicationStartPicker,
    startApplication,
  };
}
