import { CheckCircle2, Clock } from "lucide-react";
import { ModalShell } from "../../components/ModalShell";
import { Button } from "../../components/ui/button";
import { StatusPill } from "../../components/StatusPill";
import type { ApplicationSummary } from "../../lib/applicationRecords";

export type StartApplicationOptions = {
  prefillFromApplicationId?: string | null;
  startFresh?: boolean;
};

function ApplicationStartPicker({
  activeApplicationId,
  applyError,
  isApplyActionPending,
  reusableSourceApplications,
  onStartApplication,
}: {
  activeApplicationId: string | null;
  applyError: string | null;
  isApplyActionPending: boolean;
  reusableSourceApplications: ApplicationSummary[];
  onStartApplication: (options?: StartApplicationOptions) => Promise<void>;
}) {
  return (
    <div className="mt-6 space-y-3">
      <p className="text-sm leading-6 text-slate-600">
        Choose an existing application to copy its personal details,
        qualifications, employment history, and stored supporting documents into
        this new course application, or start a brand new application instead.
      </p>
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
        Most complete applications appear first.
      </p>
      {reusableSourceApplications.map((application) => (
        <button
          key={application.id}
          className="w-full rounded-[28px] border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-[var(--cta-tertiary-border)] hover:bg-white"
          disabled={isApplyActionPending}
          type="button"
          onClick={() => {
            void onStartApplication({
              prefillFromApplicationId: application.id,
            });
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-base font-semibold text-slate-900">
                {application.course.title}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {application.course.provider}
              </p>
              <p className="mt-2 text-sm font-medium text-slate-700">
                {application.completionPercentage}% complete (
                {application.completedStepCount} of {application.totalStepCount}{" "}
                sections)
              </p>
              {application.id === activeApplicationId ? (
                <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--cta-tertiary-text)]">
                  Current active application
                </p>
              ) : null}
            </div>
            <StatusPill
              icon={
                application.status === "submitted" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Clock className="h-4 w-4" />
                )
              }
              tone={application.status === "submitted" ? "success" : "warning"}
            >
              {application.status === "submitted" ? "Submitted" : "Open"}
            </StatusPill>
          </div>
        </button>
      ))}
      {applyError ? (
        <p className="text-sm font-medium text-[var(--error-text)]">
          {applyError}
        </p>
      ) : null}
      <Button
        className="w-full"
        disabled={isApplyActionPending}
        variant="soft"
        onClick={() => {
          void onStartApplication({ startFresh: true });
        }}
      >
        {isApplyActionPending
          ? "Preparing application..."
          : "Start brand new application"}
      </Button>
    </div>
  );
}

function getEligibilityResultTitle(
  isEligible: boolean,
  showApplicationStartPicker: boolean,
) {
  if (isEligible && showApplicationStartPicker) {
    return "Choose How To Start";
  }

  return isEligible ? "Evidence looks ready" : "More evidence needed";
}

function getEligibleApplyLabel({
  currentCourseDraft,
  isApplyActionPending,
  isAuthenticated,
  reusableSourceApplications,
}: {
  currentCourseDraft: ApplicationSummary | null;
  isApplyActionPending: boolean;
  isAuthenticated: boolean;
  reusableSourceApplications: ApplicationSummary[];
}) {
  if (!isAuthenticated) {
    return "Sign in to apply";
  }

  if (isApplyActionPending) {
    return "Preparing application...";
  }

  if (currentCourseDraft) {
    return "Continue application";
  }

  return reusableSourceApplications.length > 0
    ? "Choose how to start"
    : "Start application";
}

export type EligibilityOutcome = "success" | "fail" | "manual_review";

export function EligibilityResultModal({
  activeApplicationId,
  applyError,
  currentCourseDraft,
  eligibilityOutcome,
  eligibilityReason,
  isApplyActionPending,
  isAuthenticated,
  reusableSourceApplications,
  showApplicationStartPicker,
  onBrowseCourses,
  onClose,
  onEligibleApplyNow,
  onReviewRequirements,
  onStartApplication,
  onTryAgain,
}: {
  activeApplicationId: string | null;
  applyError: string | null;
  currentCourseDraft: ApplicationSummary | null;
  eligibilityOutcome: EligibilityOutcome;
  eligibilityReason: string;
  isApplyActionPending: boolean;
  isAuthenticated: boolean;
  reusableSourceApplications: ApplicationSummary[];
  showApplicationStartPicker: boolean;
  onBrowseCourses: () => void;
  onClose: () => void;
  onEligibleApplyNow: () => Promise<void>;
  onReviewRequirements: () => void;
  onStartApplication: (options?: StartApplicationOptions) => Promise<void>;
  onTryAgain: () => void;
}) {
  const isEligible = eligibilityOutcome === "success";
  const isManualReview = eligibilityOutcome === "manual_review";

  return (
    <ModalShell
      maxWidthClassName="max-w-xl"
      onClose={onClose}
      title={
        isManualReview
          ? "Admissions review needed"
          : getEligibilityResultTitle(isEligible, showApplicationStartPicker)
      }
    >
      {isEligible && showApplicationStartPicker ? (
        <ApplicationStartPicker
          activeApplicationId={activeApplicationId}
          applyError={applyError}
          isApplyActionPending={isApplyActionPending}
          reusableSourceApplications={reusableSourceApplications}
          onStartApplication={onStartApplication}
        />
      ) : (
        <>
          <p
            className={`mb-4 text-lg font-semibold ${
              isEligible ? "text-green-700" : "text-red-700"
            }`}
          >
            {isManualReview
              ? "We’ll assess your evidence against the published course rules"
              : isEligible
              ? "Your answers match the program evidence requirements"
              : "Some program evidence needs attention"}
          </p>
          <p className="text-sm leading-6 text-slate-600">
            {eligibilityReason}
          </p>
          {applyError ? (
            <p className="mt-4 text-sm font-medium text-[var(--error-text)]">
              {applyError}
            </p>
          ) : null}
          {isEligible || isManualReview ? (
            <Button
              className="mt-6 w-full"
              disabled={isApplyActionPending}
              onClick={() => {
                void onEligibleApplyNow();
              }}
            >
              {isManualReview
                ? isAuthenticated
                  ? "Start application for review"
                  : "Sign in to start review"
                : getEligibleApplyLabel({
                    currentCourseDraft,
                    isApplyActionPending,
                    isAuthenticated,
                    reusableSourceApplications,
                  })}
            </Button>
          ) : (
            <div className="mt-6 space-y-3">
              <Button className="w-full" onClick={onReviewRequirements}>
                Review entry requirements
              </Button>
              <Button className="w-full" variant="soft" onClick={onTryAgain}>
                Try again
              </Button>
              <Button
                className="w-full"
                variant="neutralOutline"
                onClick={onBrowseCourses}
              >
                Browse courses
              </Button>
            </div>
          )}
        </>
      )}
    </ModalShell>
  );
}
