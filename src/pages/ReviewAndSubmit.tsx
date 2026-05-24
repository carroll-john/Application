import { useNavigate } from "react-router-dom";
import { CopiedApplicationNotice } from "../components/CopiedApplicationNotice";
import { LoadingSpinner } from "../components/LoadingSpinner";
import {
  ReviewDeclaration,
  ReviewSection1Summary,
  ReviewSection2Summary,
  ReviewStepPage,
  ReviewValidationPanel,
  useReviewNavigation,
  useSubmitApplication,
} from "../features/review";
import { useApplication } from "../context/ApplicationContext";
import type { TranscriptEligibilityAssessment } from "../lib/eligibility/types";
import { eligibilityAdvisoryCopy, eligibilityOutcomeCopy } from "../lib/eligibility/uiCopy";

function buildEvidenceSummary(assessment: TranscriptEligibilityAssessment) {
  const wam =
    assessment.extractedData.academicPerformance?.gradeAverageOrWam?.normalizedValue ??
    assessment.extractedData.academicPerformance?.gradeAverageOrWam?.originalValue;
  const gpa =
    assessment.extractedData.academicPerformance?.gpa?.normalizedValue ??
    assessment.extractedData.academicPerformance?.gpa?.originalValue;
  const gpaScale =
    assessment.extractedData.academicPerformance?.gpaScale?.normalizedValue ??
    assessment.extractedData.academicPerformance?.gpaScale?.originalValue;
  const completion =
    assessment.extractedData.studyDetails?.completionStatus?.normalizedValue ??
    assessment.extractedData.studyDetails?.completionStatus?.originalValue;

  const parts = [
    completion ? `Completion: ${completion}` : null,
    wam ? `WAM: ${wam}` : null,
    gpa ? `GPA: ${gpa}${gpaScale ? `/${gpaScale}` : ""}` : null,
  ].filter(Boolean);

  return parts.join(" · ");
}

function getLatestEligibility(assessments: TranscriptEligibilityAssessment[]) {
  const available = assessments.filter(Boolean);
  if (available.length === 0) {
    return undefined;
  }
  return [...available].sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))[0];
}

export default function ReviewAndSubmit() {
  const navigate = useNavigate();
  const { data } = useApplication();
  const {
    groupedErrors,
    handleSaveAndExit,
    handleSubmit,
    isSubmitting,
    submitError,
    validationErrors,
  } = useSubmitApplication();
  const { navigateToReviewEdit } = useReviewNavigation(validationErrors);
  const prefilledFrom = data.applicationMeta.prefilledFrom;
  const transcriptEligibilitySnapshots = data.tertiaryQualifications
    .map((qualification) => qualification.transcriptEligibility)
    .filter((assessment): assessment is NonNullable<typeof assessment> => Boolean(assessment));
  const latestEligibility = getLatestEligibility(transcriptEligibilitySnapshots);

  return (
    <>
      <ReviewStepPage
        continueDisabled={isSubmitting}
        onContinue={handleSubmit}
        onPrevious={() => navigate("/section2/qualifications")}
        onSaveAndExit={handleSaveAndExit}
        previousDisabled={isSubmitting}
        secondaryDisabled={isSubmitting}
      >
        <div className="mb-6">
          {prefilledFrom ? (
            <CopiedApplicationNotice
              prefilledFrom={prefilledFrom}
              readyToSubmit={validationErrors.length === 0}
            />
          ) : validationErrors.length === 0 ? (
            <div className="rounded-lg border border-[var(--info-border)] bg-[var(--info-bg)] p-3">
              <p className="text-sm font-medium text-[var(--info-text)]">
                Review before submitting
              </p>
              <p className="mt-1 text-xs text-[var(--info-text)]">
                All required fields are complete. Review your details and
                attachments one more time before you submit the application.
              </p>
            </div>
          ) : null}
        </div>

        {latestEligibility ? (
          <div className="mb-6 rounded-lg border border-[var(--info-border)] bg-white p-4">
            <p className="text-sm font-semibold text-gray-900">
              Transcript eligibility: {eligibilityOutcomeCopy[latestEligibility.outcome]}
            </p>
            {buildEvidenceSummary(latestEligibility) ? (
              <p className="mt-1 text-xs text-gray-700">
                Evidence: {buildEvidenceSummary(latestEligibility)}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-gray-600">{eligibilityAdvisoryCopy}</p>
            <p className="mt-1 text-xs text-gray-700">
              Recommended next step: {latestEligibility.recommendedNextStep}
            </p>
            {latestEligibility.manualReviewRequired ? (
              <p className="mt-1 text-xs font-medium text-[var(--warning-text)]">
                Manual admissions review is still required.
              </p>
            ) : null}
          </div>
        ) : null}

        {validationErrors.length > 0 ? (
          <ReviewValidationPanel
            groupedErrors={groupedErrors}
            onEdit={navigateToReviewEdit}
          />
        ) : null}

        {submitError ? (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="font-semibold text-red-800">Submission failed</p>
            <p className="mt-1 text-sm text-red-700">{submitError}</p>
          </div>
        ) : null}

        <div className="space-y-4 sm:space-y-6">
          <ReviewSection1Summary data={data} onEdit={navigateToReviewEdit} />
          <ReviewSection2Summary data={data} onEdit={navigateToReviewEdit} />
          <ReviewDeclaration />
        </div>
      </ReviewStepPage>

      {isSubmitting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50">
          <div className="rounded-lg bg-white p-6 text-center shadow-2xl">
            <LoadingSpinner size="lg" />
            <p className="mt-4 text-sm font-medium text-slate-700">
              Submitting your application...
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
