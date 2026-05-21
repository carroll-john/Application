import { useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AppBrandHeader } from "../components/AppBrandHeader";
import { useApplication } from "../context/ApplicationContext";
import { useAuth } from "../context/AuthContext";
import {
  AuthModal,
  CourseDetailsPresentation,
  EligibilityCheckModal,
  EligibilityResultModal,
  useCourseEligibilityFlow,
} from "../features/course";
import { getCourseByCode, getDefaultCourse } from "../lib/courseCatalog";

export default function CourseDetails() {
  const navigate = useNavigate();
  const { courseCode } = useParams();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const {
    activeApplicationId,
    applications,
    beginCourseApplication,
    isHydrating,
  } = useApplication();
  const course = useMemo(
    () => getCourseByCode(courseCode) ?? getDefaultCourse(),
    [courseCode],
  );
  const shouldAutoApply =
    searchParams.get("apply") === "1" && searchParams.get("eligible") === "1";
  const selectedCourse = useMemo(
    () => ({
      code: course.code,
      intake: course.intakeLabel,
      provider: course.provider,
      title: course.title,
    }),
    [course.code, course.intakeLabel, course.provider, course.title],
  );
  const eligibility = useCourseEligibilityFlow({
    activeApplicationId,
    applications,
    beginCourseApplication,
    course,
    isAuthenticated,
    isHydrating,
    navigate,
    selectedCourse,
    shouldAutoApply,
  });

  return (
    <div className="min-h-screen bg-white">
      <AppBrandHeader>
        <div className="hidden rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 sm:block">
          {course.provider}
        </div>
      </AppBrandHeader>

      <CourseDetailsPresentation
        course={course}
        courseDetailsSectionRef={eligibility.courseDetailsSectionRef}
        entryRequirementsRef={eligibility.entryRequirementsRef}
        onOpenEligibilityCheck={() => eligibility.setShowEligibility(true)}
      />

      {eligibility.showEligibility && !eligibility.eligibilityOutcome ? (
        <EligibilityCheckModal
          course={course}
          eligibilityForm={eligibility.eligibilityForm}
          isComplete={eligibility.isEligibilityFormComplete}
          requiresExperienceInput={eligibility.requiresExperienceInput}
          onAnswerChange={(updates) =>
            eligibility.setEligibilityForm((previous) => ({
              ...previous,
              ...updates,
            }))
          }
          onClose={() => {
            eligibility.setApplyError(null);
            eligibility.setShowEligibility(false);
          }}
          onComplete={eligibility.handleEligibilityComplete}
        />
      ) : null}

      {eligibility.eligibilityOutcome ? (
        <EligibilityResultModal
          activeApplicationId={eligibility.activeApplicationId}
          applyError={eligibility.applyError}
          currentCourseDraft={eligibility.currentCourseDraft}
          eligibilityOutcome={eligibility.eligibilityOutcome}
          eligibilityReason={eligibility.eligibilityReason}
          isApplyActionPending={eligibility.isApplyActionPending}
          isAuthenticated={eligibility.isAuthenticated}
          reusableSourceApplications={eligibility.reusableSourceApplications}
          showApplicationStartPicker={eligibility.showApplicationStartPicker}
          onBrowseCourses={eligibility.handleBrowseCourses}
          onClose={eligibility.resetEligibilityState}
          onEligibleApplyNow={eligibility.handleEligibleApplyNow}
          onReviewRequirements={eligibility.handleReviewRequirements}
          onStartApplication={eligibility.startApplication}
          onTryAgain={eligibility.handleTryEligibilityAgain}
        />
      ) : null}

      {eligibility.authGateContext ? (
        <AuthModal
          context={eligibility.authGateContext}
          onAuthenticated={() => {
            eligibility.setAuthGateContext(null);
          }}
          onClose={() => {
            eligibility.setAuthGateContext(null);
            eligibility.setPendingAuthAction(null);
          }}
        />
      ) : null}
    </div>
  );
}
