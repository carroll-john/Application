import { HelpCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/button";
import { submitEligibilityFeedback } from "../../lib/eligibility/feedbackClient";
import type { EligibilityRequirementStatus } from "../../lib/eligibility/types";
import {
  eligibilityFeedbackCopy,
  eligibilityFeedbackStatusLabels,
  eligibilityRequirementStatusCopy,
  feedbackTriggerLabel,
} from "../../lib/eligibility/uiCopy";

interface EligibilityRowFeedbackProps {
  requirementId: string;
  /** Short display heading of the requirement, used to disambiguate the trigger for a11y. */
  requirementHeading?: string;
  requirementSourceText: string;
  originalStatus: EligibilityRequirementStatus;
  courseCode?: string;
  courseTitle?: string;
  modelId?: string;
  promptVersion?: string;
  reasonCode?: string;
  rulesVersion?: string;
  schemaVersion?: string;
  serviceVersion?: string;
}

/**
 * Per-requirement affordance that lets the applicant suggest a correction when the automated
 * status does not match their transcript. Feedback is posted to PostHog for admissions review.
 */
export function EligibilityRowFeedback({
  requirementId,
  requirementHeading,
  requirementSourceText,
  originalStatus,
  courseCode,
  courseTitle,
  modelId,
  promptVersion,
  reasonCode,
  rulesVersion,
  schemaVersion,
  serviceVersion,
}: EligibilityRowFeedbackProps) {
  const [expanded, setExpanded] = useState(false);
  const [override, setOverride] = useState<EligibilityRequirementStatus | "">("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <p className="mt-3 rounded-md border border-[var(--info-border)] bg-[var(--info-bg)] px-3 py-2 text-[11px] text-[var(--info-text)] sm:text-xs">
        {eligibilityFeedbackCopy.submitted}
      </p>
    );
  }

  if (!expanded) {
    return (
      <Button
        aria-label={
          requirementHeading
            ? feedbackTriggerLabel(requirementHeading)
            : eligibilityFeedbackCopy.trigger
        }
        className="mt-3 h-auto min-h-9 rounded-full px-3 py-1.5 text-[11px] sm:text-xs"
        size="sm"
        type="button"
        variant="outline"
        onClick={() => setExpanded(true)}
      >
        <HelpCircle aria-hidden="true" className="h-3.5 w-3.5" />
        {eligibilityFeedbackCopy.trigger}
      </Button>
    );
  }

  const canSubmit = override !== "" && override !== originalStatus && !submitting;

  return (
    <div className="mt-3 rounded-lg border border-[var(--info-border)] bg-[var(--info-bg)] p-3 sm:p-4">
      <p className="text-xs font-semibold text-gray-900 sm:text-sm">
        {eligibilityFeedbackCopy.prompt}
      </p>
      <p className="mt-1 text-[11px] leading-5 text-gray-700 sm:text-xs">
        {eligibilityFeedbackCopy.intro}
      </p>

      <div className="mt-3 rounded-md border border-white/80 bg-white/70 px-3 py-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 sm:text-xs">
          {eligibilityFeedbackCopy.automatedResultLabel}
        </p>
        <p className="mt-1 text-xs font-semibold text-gray-900 sm:text-sm">
          {eligibilityRequirementStatusCopy[originalStatus]}
        </p>
      </div>

      <fieldset className="mt-3">
        <legend className="text-[11px] font-medium text-gray-800 sm:text-xs">
          {eligibilityFeedbackCopy.suggestedStatusLegend}
        </legend>
        <div className="mt-2 flex flex-col gap-2">
          {(["pass", "fail", "unknown"] as const).map((status) => (
            <label
              key={status}
              className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-xs sm:text-sm ${
                override === status
                  ? "border-[var(--cta-secondary)] bg-white"
                  : "border-gray-200 bg-white/80"
              }`}
            >
              <input
                type="radio"
                name={`feedback-${requirementId}`}
                value={status}
                checked={override === status}
                onChange={() => setOverride(status)}
                className="mt-0.5 h-3.5 w-3.5"
              />
              <span className="font-medium text-gray-900">
                {eligibilityFeedbackStatusLabels[status]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label
        className="mt-3 block text-[11px] font-medium text-gray-800 sm:text-xs"
        htmlFor={`reason-${requirementId}`}
      >
        {eligibilityFeedbackCopy.reasonLabel}
      </label>
      <textarea
        id={`reason-${requirementId}`}
        value={reason}
        onChange={(event) => setReason(event.target.value.slice(0, 500))}
        rows={3}
        placeholder={eligibilityFeedbackCopy.reasonPlaceholder}
        className="mt-1 w-full rounded-md border border-gray-300 bg-white p-2 text-xs sm:text-sm"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          disabled={!canSubmit}
          size="sm"
          type="button"
          variant="soft"
          onClick={() => {
            if (override === "" || override === originalStatus) return;
            setSubmitting(true);
            void submitEligibilityFeedback({
              requirementId,
              requirementSourceText,
              originalStatus,
              overrideStatus: override,
              reason: reason.trim() || undefined,
              courseCode,
              courseTitle,
              modelId,
              promptVersion,
              reasonCode,
              rulesVersion,
              schemaVersion,
              serviceVersion,
            }).then(() => {
              setSubmitting(false);
              setSubmitted(true);
            });
          }}
        >
          {submitting ? eligibilityFeedbackCopy.submitting : eligibilityFeedbackCopy.submit}
        </Button>
        <Button
          size="sm"
          type="button"
          variant="neutralOutline"
          onClick={() => {
            setExpanded(false);
            setOverride("");
            setReason("");
          }}
        >
          {eligibilityFeedbackCopy.cancel}
        </Button>
      </div>
    </div>
  );
}
