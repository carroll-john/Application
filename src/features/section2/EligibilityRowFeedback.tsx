import { useState } from "react";
import { submitEligibilityFeedback } from "../../lib/eligibility/feedbackClient";
import type { EligibilityRequirementStatus } from "../../lib/eligibility/types";

interface EligibilityRowFeedbackProps {
  requirementId: string;
  requirementSourceText: string;
  originalStatus: EligibilityRequirementStatus;
  courseCode?: string;
  courseTitle?: string;
  rulesVersion?: string;
  serviceVersion?: string;
}

/**
 * Per-requirement-row affordance that lets the applicant (or admissions reviewer running the app)
 * flag an automated check as wrong. The override is posted to PostHog for use as a labelled example
 * when tuning prompts, fixtures, or the matcher.
 *
 * Intentionally low-key: a single text trigger that expands into a small inline form. We don't want
 * to nudge users toward overriding correct results, only to provide a release valve when the
 * automated assessment misjudges their evidence.
 */
export function EligibilityRowFeedback({
  requirementId,
  requirementSourceText,
  originalStatus,
  courseCode,
  courseTitle,
  rulesVersion,
  serviceVersion,
}: EligibilityRowFeedbackProps) {
  const [expanded, setExpanded] = useState(false);
  const [override, setOverride] = useState<EligibilityRequirementStatus | "">("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <p className="mt-2 text-[11px] text-gray-600 sm:text-xs">
        Thanks — your feedback has been recorded for admissions review.
      </p>
    );
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="mt-2 text-[11px] font-medium text-[var(--cta-secondary)] underline-offset-2 hover:underline sm:text-xs"
      >
        This check seems wrong
      </button>
    );
  }

  const canSubmit = override !== "" && override !== originalStatus && !submitting;

  return (
    <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-3">
      <p className="text-xs font-semibold text-gray-900 sm:text-sm">
        Flag this check for admissions review
      </p>
      <fieldset className="mt-2">
        <legend className="text-[11px] text-gray-700 sm:text-xs">Correct status</legend>
        <div className="mt-1 flex flex-wrap gap-3 text-xs sm:text-sm">
          {(["pass", "fail", "unknown"] as const).map((status) => (
            <label key={status} className="inline-flex items-center gap-1">
              <input
                type="radio"
                name={`feedback-${requirementId}`}
                value={status}
                checked={override === status}
                onChange={() => setOverride(status)}
                className="h-3 w-3"
              />
              <span className="capitalize">{status}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="mt-2 block text-[11px] text-gray-700 sm:text-xs" htmlFor={`reason-${requirementId}`}>
        Optional reason
      </label>
      <textarea
        id={`reason-${requirementId}`}
        value={reason}
        onChange={(event) => setReason(event.target.value.slice(0, 500))}
        rows={2}
        placeholder="What evidence makes you think the automated status is wrong?"
        className="mt-1 w-full rounded-md border border-gray-300 bg-white p-2 text-xs sm:text-sm"
      />
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={!canSubmit}
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
              rulesVersion,
              serviceVersion,
            }).then(() => {
              setSubmitting(false);
              setSubmitted(true);
            });
          }}
          className="rounded-md bg-[var(--cta-secondary)] px-3 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
        >
          {submitting ? "Submitting..." : "Submit"}
        </button>
        <button
          type="button"
          onClick={() => {
            setExpanded(false);
            setOverride("");
            setReason("");
          }}
          className="rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-semibold text-gray-700 sm:text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
