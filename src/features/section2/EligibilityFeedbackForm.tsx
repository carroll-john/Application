import { HelpCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/button";
import { submitEligibilityFeedback } from "../../lib/eligibility/feedbackClient";
import type { EligibilityRequirementStatus } from "../../lib/eligibility/types";
import {
  eligibilityFeedbackCopy,
  eligibilityRequirementStatusCopy,
} from "../../lib/eligibility/uiCopy";

export interface EligibilityFeedbackRow {
  heading: string;
  originalStatus: EligibilityRequirementStatus;
  /** Durable machine reason behind the automated status, attached to the feedback event. */
  reasonCode?: string;
  requirementId: string;
  requirementSourceText: string;
}

interface EligibilityFeedbackFormProps {
  courseCode?: string;
  courseTitle?: string;
  modelId?: string;
  promptVersion?: string;
  rows: EligibilityFeedbackRow[];
  rulesVersion?: string;
  schemaVersion?: string;
  serviceVersion?: string;
}

/**
 * One entry point for disputing automated evidence results, covering every checked requirement
 * at once instead of a separate trigger + form per row. The applicant flags which items look
 * wrong and adds one shared note; each flagged item is reported for admissions review.
 */
export function EligibilityFeedbackForm({
  courseCode,
  courseTitle,
  modelId,
  promptVersion,
  rows,
  rulesVersion,
  schemaVersion,
  serviceVersion,
}: EligibilityFeedbackFormProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (rows.length === 0) {
    return null;
  }

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

  function toggleRow(requirementId: string) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(requirementId)) {
        next.delete(requirementId);
      } else {
        next.add(requirementId);
      }
      return next;
    });
  }

  const canSubmit = selectedIds.size > 0 && !submitting;

  return (
    <div className="mt-3 rounded-lg border border-[var(--info-border)] bg-[var(--info-bg)] p-3 sm:p-4">
      <p className="text-xs font-semibold text-gray-900 sm:text-sm">
        {eligibilityFeedbackCopy.prompt}
      </p>
      <p className="mt-1 text-[11px] leading-5 text-gray-700 sm:text-xs">
        {eligibilityFeedbackCopy.intro}
      </p>

      <fieldset className="mt-3">
        <legend className="text-[11px] font-medium text-gray-800 sm:text-xs">
          {eligibilityFeedbackCopy.selectRowsLegend}
        </legend>
        <div className="mt-2 flex flex-col gap-2">
          {rows.map((row) => (
            <label
              key={row.requirementId}
              className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-xs sm:text-sm ${
                selectedIds.has(row.requirementId)
                  ? "border-[var(--cta-secondary)] bg-white"
                  : "border-gray-200 bg-white/80"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedIds.has(row.requirementId)}
                onChange={() => toggleRow(row.requirementId)}
                className="mt-0.5 h-3.5 w-3.5"
              />
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-gray-900">{row.heading}</span>
                <span className="block text-[11px] text-gray-500 sm:text-xs">
                  {eligibilityFeedbackCopy.automatedResultLabel}:{" "}
                  {eligibilityRequirementStatusCopy[row.originalStatus]}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mt-3 block text-[11px] font-medium text-gray-800 sm:text-xs" htmlFor="eligibility-feedback-reason">
        {eligibilityFeedbackCopy.reasonLabel}
      </label>
      <textarea
        id="eligibility-feedback-reason"
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
            if (selectedIds.size === 0) return;
            setSubmitting(true);
            const flaggedRows = rows.filter((row) => selectedIds.has(row.requirementId));
            void Promise.all(
              flaggedRows.map((row) =>
                submitEligibilityFeedback({
                  requirementId: row.requirementId,
                  requirementSourceText: row.requirementSourceText,
                  originalStatus: row.originalStatus,
                  overrideStatus: "unknown",
                  reason: reason.trim() || undefined,
                  courseCode,
                  courseTitle,
                  modelId,
                  promptVersion,
                  reasonCode: row.reasonCode,
                  rulesVersion,
                  schemaVersion,
                  serviceVersion,
                }),
              ),
            ).then(() => {
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
            setSelectedIds(new Set());
            setReason("");
          }}
        >
          {eligibilityFeedbackCopy.cancel}
        </Button>
      </div>
    </div>
  );
}
