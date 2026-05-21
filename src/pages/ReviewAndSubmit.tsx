import { useNavigate } from "react-router-dom";
import { CopiedApplicationNotice } from "../components/CopiedApplicationNotice";
import { FormActionBar } from "../components/FormActionBar";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ReviewDeclaration } from "../features/review/ReviewDeclaration";
import { ReviewSection1Summary } from "../features/review/ReviewSection1Summary";
import { ReviewSection2Summary } from "../features/review/ReviewSection2Summary";
import { ReviewValidationPanel } from "../features/review/ReviewValidationPanel";
import { useReviewNavigation } from "../features/review/useReviewNavigation";
import { useSubmitApplication } from "../features/review/useSubmitApplication";
import { useApplication } from "../context/ApplicationContext";

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

  return (
    <div className="bg-gray-50 pb-12">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-6 sm:mb-8">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-700 sm:text-sm">
              Section 3 of 3
            </span>
            <span className="text-xs font-medium text-gray-700 sm:text-sm">
              100%
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-200">
            <div className="h-2 w-full rounded-full bg-[var(--cta-secondary)] transition-all duration-300" />
          </div>
        </div>

        <div className="mb-6">
          <h1 className="mb-2 text-2xl font-bold text-gray-900 sm:text-3xl">
            Review and submit
          </h1>
          <p className="text-sm text-gray-600 sm:text-base">
            Please review all information carefully before submitting your
            application
          </p>
          {prefilledFrom ? (
            <CopiedApplicationNotice
              className="mt-4"
              prefilledFrom={prefilledFrom}
              readyToSubmit={validationErrors.length === 0}
            />
          ) : validationErrors.length === 0 ? (
            <div className="mt-4 rounded-lg border border-[var(--info-border)] bg-[var(--info-bg)] p-3">
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

        <FormActionBar
          previousDisabled={isSubmitting}
          previousLabel="Previous"
          primaryDisabled={isSubmitting}
          primaryLabel="Submit application"
          onPrevious={() => navigate("/section2/qualifications")}
          onPrimary={handleSubmit}
          onSecondary={handleSaveAndExit}
          secondaryDisabled={isSubmitting}
          secondaryLabel="Save & Exit"
        />
      </div>

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
    </div>
  );
}
