import { useCallback, useEffect, useRef, useState } from "react";
import type { NavigateFunction } from "react-router-dom";
import type { ApplicationSummary } from "../../lib/applicationRecords";
import type { SelectedCourse } from "../../lib/applicationData";
import type { CourseCatalogEntry } from "../../lib/courseCatalog";
import {
  evaluateCourseRequirementAnswers,
  isCourseEligibilityFormComplete,
  type EligibilityAnswers,
} from "../../lib/courseEligibility";
import {
  capturePostHogEvent,
  getCourseAnalyticsProperties,
} from "../../lib/posthog";
import { buildCourseApplyRedirectPath } from "./lib/courseApplyIntent";
import {
  clearPendingEligibilityCheck,
  loadPendingEligibilityCheck,
  savePendingEligibilityCheck,
} from "./lib/courseEligibilityStorage";
import type { AuthGateContext } from "./useCourseApplicationStart";
import {
  useCourseApplicationStart,
  type BeginCourseApplication,
} from "./useCourseApplicationStart";
import type { EligibilityOutcome } from "./EligibilityResultModal";

interface UseCourseEligibilityFlowOptions {
  activeApplicationId: string | null;
  applications: ApplicationSummary[];
  beginCourseApplication: BeginCourseApplication;
  course: CourseCatalogEntry;
  isAuthenticated: boolean;
  isHydrating: boolean;
  navigate: NavigateFunction;
  selectedCourse: SelectedCourse;
  shouldAutoApply: boolean;
}

export function useCourseEligibilityFlow({
  activeApplicationId,
  applications,
  beginCourseApplication,
  course,
  isAuthenticated,
  isHydrating,
  navigate,
  selectedCourse,
  shouldAutoApply,
}: UseCourseEligibilityFlowOptions) {
  const [showEligibility, setShowEligibility] = useState(false);
  const [eligibilityOutcome, setEligibilityOutcome] =
    useState<EligibilityOutcome | null>(null);
  const [eligibilityReason, setEligibilityReason] = useState("");
  const [eligibilityForm, setEligibilityForm] = useState<EligibilityAnswers>({
    educationLevel: "",
    experienceRange: "",
  });
  const [authGateContext, setAuthGateContext] =
    useState<AuthGateContext | null>(null);
  const [pendingAuthAction, setPendingAuthAction] =
    useState<AuthGateContext | null>(null);
  const [signUpRedirectPath, setSignUpRedirectPath] = useState<string | null>(
    null,
  );
  const courseDetailsSectionRef = useRef<HTMLElement | null>(null);
  const entryRequirementsRef = useRef<HTMLDivElement | null>(null);

  const resetEligibilityView = useCallback(() => {
    setEligibilityOutcome(null);
    setEligibilityReason("");
    setShowEligibility(false);
    setSignUpRedirectPath(null);
  }, []);

  const showEligibleResult = useCallback((reason: string) => {
    setEligibilityOutcome("success");
    setEligibilityReason(reason);
  }, []);

  const openAuthGate = useCallback(
    (context: AuthGateContext) => {
      setPendingAuthAction(context);
      setAuthGateContext(context);
      if (context === "apply") {
        // The apply gate only opens for an already-eligible applicant, so the
        // verification link should resume them straight into their course
        // application via the course page's auto-apply flow.
        setSignUpRedirectPath(buildCourseApplyRedirectPath(course.code));
      }
      capturePostHogEvent("auth_gate_opened", {
        ...getCourseAnalyticsProperties(course),
        auth_context: context,
      });
    },
    [course],
  );

  const {
    applyError,
    currentCourseDraft,
    handleEligibleApplyNow,
    isApplyActionPending,
    resetApplicationStartState,
    reusableSourceApplications,
    setApplyError,
    showApplicationStartPicker,
    startApplication,
  } = useCourseApplicationStart({
    activeApplicationId,
    applications,
    beginCourseApplication,
    course,
    isAuthenticated,
    isHydrating,
    navigate,
    onAuthRequired: openAuthGate,
    onEligibleResult: showEligibleResult,
    onResetEligibilityState: resetEligibilityView,
    selectedCourse,
    shouldAutoApply,
  });

  const resetEligibilityState = useCallback(() => {
    resetApplicationStartState();
    resetEligibilityView();
  }, [resetApplicationStartState, resetEligibilityView]);

  const isEligibilityFormComplete = isCourseEligibilityFormComplete(
    course,
    eligibilityForm,
  );

  const resolveEligibilityResult = useCallback(
    (answers: EligibilityAnswers) => {
      const result = evaluateCourseRequirementAnswers(course, answers);

      capturePostHogEvent("eligibility_check_completed", {
        ...getCourseAnalyticsProperties(course),
        academic_threshold: answers.academicThreshold,
        education_level: answers.educationLevel,
        english_evidence: answers.englishEvidence,
        eligible: result.eligible,
        experience_range: answers.experienceRange,
        field_of_study: answers.fieldOfStudy,
      });
      clearPendingEligibilityCheck();
      setEligibilityOutcome(result.eligible ? "success" : "fail");
      setEligibilityReason(result.reason ?? "");
    },
    [course],
  );

  const handleEligibilityComplete = useCallback(() => {
    setApplyError(null);

    if (!isAuthenticated) {
      const { eligible } = evaluateCourseRequirementAnswers(course, eligibilityForm);

      if (eligible) {
        // Resume an eligible applicant into their application after they verify
        // their email by routing the link through the course page's auto-apply
        // flow, which creates the course application and lands them on the
        // overview. Clear any stale pending check so it can't surface a result
        // modal mid-redirect.
        clearPendingEligibilityCheck();
        setSignUpRedirectPath(buildCourseApplyRedirectPath(course.code));
      } else {
        // Ineligible applicants keep the default redirect back to the course
        // page, where the saved pending check surfaces their result after they
        // confirm their email.
        savePendingEligibilityCheck(course.code, eligibilityForm);
        setSignUpRedirectPath(null);
      }

      openAuthGate("eligibility");
      return;
    }

    resolveEligibilityResult(eligibilityForm);
  }, [
    course,
    eligibilityForm,
    isAuthenticated,
    openAuthGate,
    resolveEligibilityResult,
    setApplyError,
  ]);

  const handleTryEligibilityAgain = useCallback(() => {
    setApplyError(null);
    setEligibilityReason("");
    setEligibilityOutcome(null);
  }, [setApplyError]);

  const handleBrowseCourses = useCallback(() => {
    resetEligibilityState();
    navigate("/");
  }, [navigate, resetEligibilityState]);

  const handleReviewRequirements = useCallback(() => {
    resetEligibilityState();

    window.requestAnimationFrame(() => {
      const target = entryRequirementsRef.current ?? courseDetailsSectionRef.current;
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [resetEligibilityState]);

  useEffect(() => {
    if (!isAuthenticated || !pendingAuthAction) {
      return;
    }

    if (pendingAuthAction === "apply" && isHydrating) {
      return;
    }

    setAuthGateContext(null);

    if (pendingAuthAction === "eligibility") {
      const pendingAnswers =
        loadPendingEligibilityCheck(course.code) ?? eligibilityForm;
      setPendingAuthAction(null);
      resolveEligibilityResult(pendingAnswers);
      return;
    }

    setPendingAuthAction(null);
    void handleEligibleApplyNow();
  }, [
    course.code,
    eligibilityForm,
    handleEligibleApplyNow,
    isAuthenticated,
    isHydrating,
    pendingAuthAction,
    resolveEligibilityResult,
  ]);

  useEffect(() => {
    if (
      isAuthenticated &&
      !eligibilityOutcome &&
      !pendingAuthAction &&
      !shouldAutoApply
    ) {
      const pendingAnswers = loadPendingEligibilityCheck(course.code);

      if (pendingAnswers) {
        setEligibilityForm(pendingAnswers);
        resolveEligibilityResult(pendingAnswers);
      }
    }
  }, [
    course.code,
    eligibilityOutcome,
    isAuthenticated,
    pendingAuthAction,
    resolveEligibilityResult,
    shouldAutoApply,
  ]);

  return {
    activeApplicationId,
    applyError,
    authGateContext,
    courseDetailsSectionRef,
    currentCourseDraft,
    eligibilityForm,
    eligibilityOutcome,
    eligibilityReason,
    entryRequirementsRef,
    handleBrowseCourses,
    handleEligibleApplyNow,
    handleEligibilityComplete,
    handleReviewRequirements,
    handleTryEligibilityAgain,
    isApplyActionPending,
    isAuthenticated,
    isEligibilityFormComplete,
    pendingAuthAction,
    resetEligibilityState,
    reusableSourceApplications,
    setApplyError,
    setAuthGateContext,
    setEligibilityForm,
    setPendingAuthAction,
    setShowEligibility,
    showApplicationStartPicker,
    showEligibility,
    signUpRedirectPath,
    startApplication,
  };
}
