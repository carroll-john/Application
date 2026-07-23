import { HelpCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/button";
import {
  buildEligibilityFeedbackDocumentPayload,
  saveEligibilityFeedbackDocument,
} from "../../lib/eligibility/eligibilityFeedbackDocument";
import { submitEligibilityFeedback } from "../../lib/eligibility/feedbackClient";
import { trackEligibilityFeedbackSubmitted } from "../../lib/posthog";
import type { UploadedDocument } from "../../lib/documentStorage";
import type { EligibilityRequirementStatus } from "../../lib/eligibility/types";
import {
  eligibilityFeedbackCopy,
  eligibilityRequirementStatusCopy,
} from "../../lib/eligibility/uiCopy";

export interface EligibilityFeedbackRow {
  explanation?: string;
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
  currentDocument?: UploadedDocument;
  ensureApplicationRow: () => Promise<string>;
  modelId?: string;
  onSaveFeedback: (document: UploadedDocument) => Promise<void>;
  promptVersion?: string;
  rows: EligibilityFeedbackRow[];
  rulesVersion?: string;
  schemaVersion?: string;
  serviceVersion?: string;
}

/**
 * One entry point for disputing automated evidence results. The applicant flags
 * which requirements look wrong and can add a separate note for each one.
 */
export function EligibilityFeedbackForm({
  courseCode,
  courseTitle,
  currentDocument,
  ensureApplicationRow,
  modelId,
  onSaveFeedback,
  promptVersion,
  rows,
  rulesVersion,
  schemaVersion,
  serviceVersion,
}: EligibilityFeedbackFormProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [rowNotes, setRowNotes] = useState<Readonly<Record<string, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(Boolean(currentDocument));
  const [saveError, setSaveError] = useState<string | null>(null);

  if (rows.length === 0) {
    return null;
  }

  if (submitted) {
    return (
      <p className="content-block-compact mt-3 rounded-md border border-[var(--info-border)] bg-[var(--info-bg)] px-3 py-2 text-[11px] text-[var(--info-text)] sm:text-xs">
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
        setRowNotes((notes) => {
          const updated = { ...notes };
          delete updated[requirementId];
          return updated;
        });
      } else {
        next.add(requirementId);
      }
      return next;
    });
  }

  function updateRowNote(requirementId: string, value: string) {
    setRowNotes((previous) => ({
      ...previous,
      [requirementId]: value.slice(0, 500),
    }));
  }

  const canSubmit = selectedIds.size > 0 && !submitting;

  return (
    <div className="content-block-compact mt-3 rounded-lg border border-[var(--info-border)] bg-[var(--info-bg)] p-3 sm:p-4">
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
          {rows.map((row) => {
            const selected = selectedIds.has(row.requirementId);
            const noteId = `eligibility-feedback-note-${row.requirementId}`;

            return (
              <div
                key={row.requirementId}
                className={`rounded-md border px-3 py-2 text-xs sm:text-sm ${
                  selected
                    ? "border-[var(--cta-secondary)] bg-white"
                    : "border-gray-200 bg-white/80"
                }`}
              >
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleRow(row.requirementId)}
                    className="mt-0.5 h-3.5 w-3.5"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-gray-900">{row.heading}</span>
                    {row.explanation ? (
                      <span className="mt-0.5 block text-[11px] text-gray-700 sm:text-xs">
                        {row.explanation}
                      </span>
                    ) : null}
                    <span className="mt-0.5 block text-[11px] text-gray-500 sm:text-xs">
                      {eligibilityFeedbackCopy.automatedResultLabel}:{" "}
                      {eligibilityRequirementStatusCopy[row.originalStatus]}
                    </span>
                  </span>
                </label>
                <div className="mt-2 pl-5">
                  <label
                    className="block text-[11px] font-medium text-gray-800 sm:text-xs"
                    htmlFor={noteId}
                  >
                    {eligibilityFeedbackCopy.rowCommentLabel}
                  </label>
                  <textarea
                    id={noteId}
                    value={rowNotes[row.requirementId] ?? ""}
                    onChange={(event) =>
                      updateRowNote(row.requirementId, event.target.value)
                    }
                    rows={2}
                    placeholder={eligibilityFeedbackCopy.rowCommentPlaceholder}
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white p-2 text-xs sm:text-sm"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </fieldset>

      {saveError ? (
        <p className="mt-3 text-[11px] text-[var(--error-text)] sm:text-xs">{saveError}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          disabled={!canSubmit}
          size="sm"
          type="button"
          variant="soft"
          onClick={() => {
            if (selectedIds.size === 0) return;
            setSaveError(null);
            setSubmitting(true);
            const flaggedRows = rows.filter((row) => selectedIds.has(row.requirementId));

            void (async () => {
              try {
                const applicationId = await ensureApplicationRow();
                const payload = buildEligibilityFeedbackDocumentPayload({
                  assessment: {
                    modelId,
                    promptVersion,
                    rulesVersion,
                    schemaVersion,
                    serviceVersion,
                  },
                  courseCode,
                  courseTitle,
                  flaggedRequirements: flaggedRows.map((row) => ({
                    explanation: row.explanation,
                    heading: row.heading,
                    note: rowNotes[row.requirementId]?.trim() || undefined,
                    originalStatus: row.originalStatus,
                    reasonCode: row.reasonCode,
                    requirementId: row.requirementId,
                    requirementSourceText: row.requirementSourceText,
                  })),
                });
                const document = await saveEligibilityFeedbackDocument({
                  applicationId,
                  currentDocument,
                  payload,
                });
                await onSaveFeedback(document);

                void Promise.all(
                  flaggedRows.map((row) =>
                    submitEligibilityFeedback({
                      requirementId: row.requirementId,
                      requirementSourceText: row.requirementSourceText,
                      originalStatus: row.originalStatus,
                      overrideStatus: "unknown",
                      reason: rowNotes[row.requirementId]?.trim() || undefined,
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
                );

                trackEligibilityFeedbackSubmitted({
                  courseCode,
                  courseTitle,
                  flaggedRequirementIds: flaggedRows.map((row) => row.requirementId),
                  hasNote: flaggedRows.some((row) =>
                    Boolean(rowNotes[row.requirementId]?.trim()),
                  ),
                  reasonCodes: flaggedRows
                    .map((row) => row.reasonCode)
                    .filter((code): code is string => Boolean(code)),
                });
                setSubmitted(true);
              } catch {
                setSaveError(eligibilityFeedbackCopy.saveFailed);
              } finally {
                setSubmitting(false);
              }
            })();
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
            setRowNotes({});
            setSaveError(null);
          }}
        >
          {eligibilityFeedbackCopy.cancel}
        </Button>
      </div>
    </div>
  );
}
