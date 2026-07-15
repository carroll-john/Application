import type { ReactNode } from "react";
import { Button } from "../../components/ui/button";
import {
  buildAssessmentCheckEvidenceRows,
  buildTranscriptReviewSummary,
  dedupeProgramEvidenceRowsByHeading,
  type ProgramEvidenceRow,
} from "../../lib/eligibility/programEvidence";
import { requirementKindLabel } from "../../lib/eligibility/requirements";
import type { UploadedDocument } from "../../lib/documentStorage";
import type { EligibilityRequirementStatus, TranscriptEligibilityAssessment } from "../../lib/eligibility/types";
import { programEvidenceAdvisoryCopy } from "../../lib/eligibility/uiCopy";
import {
  EligibilityFeedbackForm,
  type EligibilityFeedbackRow,
} from "./EligibilityFeedbackForm";
import type {
  Section2EvidencePlan,
  Section2EvidenceSectionKey,
} from "./section2EvidencePlan";

function feedbackStatusFromRow(
  row: ProgramEvidenceRow,
): EligibilityRequirementStatus {
  if (row.requirementStatus) {
    return row.requirementStatus;
  }
  if (row.status === "met") {
    return "pass";
  }
  return "unknown";
}

function buildFeedbackRowsFromEvidenceRows(
  rows: readonly ProgramEvidenceRow[],
): EligibilityFeedbackRow[] {
  return rows.map((row) => ({
    explanation: row.explanation,
    heading: row.heading,
    originalStatus: feedbackStatusFromRow(row),
    reasonCode: row.reasonCode,
    requirementId: row.requirementId,
    requirementSourceText: row.sourceText,
  }));
}

export function getLatestTranscriptAssessment(
  assessments: Array<TranscriptEligibilityAssessment | undefined>,
) {
  const available = assessments.filter(Boolean) as TranscriptEligibilityAssessment[];
  if (available.length === 0) {
    return undefined;
  }

  return [...available].sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))[0];
}

function readEvidenceValue(
  assessment: TranscriptEligibilityAssessment,
  group: keyof TranscriptEligibilityAssessment["extractedData"],
  field: string,
) {
  const source = assessment.extractedData[group] as Record<string, unknown> | undefined;
  if (!source) {
    return undefined;
  }

  const item = source[field] as
    | { normalizedValue?: string; originalValue?: string }
    | undefined;
  if (!item || typeof item !== "object") {
    return undefined;
  }

  return item.normalizedValue ?? item.originalValue;
}

export function buildAssessmentEvidenceSummary(assessment: TranscriptEligibilityAssessment) {
  const wam = readEvidenceValue(assessment, "academicPerformance", "gradeAverageOrWam");
  const gpa = readEvidenceValue(assessment, "academicPerformance", "gpa");
  const gpaScale = readEvidenceValue(assessment, "academicPerformance", "gpaScale");
  const completion = readEvidenceValue(assessment, "studyDetails", "completionStatus");

  const parts: string[] = [];
  if (completion) {
    parts.push(`Completion: ${completion}`);
  }
  if (wam) {
    parts.push(`WAM: ${wam}`);
  }
  if (gpa) {
    parts.push(`GPA: ${gpa}${gpaScale ? `/${gpaScale}` : ""}`);
  }
  return parts.join(" · ");
}

function buildAssessmentEvidenceRows(assessment: TranscriptEligibilityAssessment) {
  const wam = readEvidenceValue(assessment, "academicPerformance", "gradeAverageOrWam");
  const gpa = readEvidenceValue(assessment, "academicPerformance", "gpa");
  const gpaScale = readEvidenceValue(assessment, "academicPerformance", "gpaScale");
  const completion = readEvidenceValue(assessment, "studyDetails", "completionStatus");
  const rows: Array<{
    explanation: string;
    id: string;
    sourceText: string;
  }> = [];

  if (completion) {
    rows.push({
      explanation: `Completion status: ${completion}.`,
      id: "completion-status",
      sourceText: "Qualification completion from transcript",
    });
  }

  const academicResults = [
    wam ? `WAM: ${wam}` : null,
    gpa ? `GPA: ${gpa}${gpaScale ? `/${gpaScale}` : ""}` : null,
  ].filter(Boolean);

  if (academicResults.length > 0) {
    rows.push({
      explanation: academicResults.join(" · "),
      id: "academic-result",
      sourceText: "Academic result from transcript",
    });
  }

  return rows;
}

function EvidenceReviewRow({
  action,
  explanation,
  explanationItems,
  heading,
}: {
  action?: ReactNode;
  explanation: string;
  explanationItems?: string[];
  heading: string;
}) {
  return (
    <li className="rounded-md border border-gray-200 p-3">
      <p className="text-xs font-semibold text-gray-900 sm:text-sm">{heading}</p>
      {explanationItems && explanationItems.length > 0 ? (
        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-gray-700 sm:text-sm">
          {explanationItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-xs text-gray-700 sm:text-sm">{explanation}</p>
      )}
      {action ? <div className="mt-3 flex justify-end">{action}</div> : null}
    </li>
  );
}

interface SupportingEvidencePanelProps {
  assessment?: TranscriptEligibilityAssessment;
  courseCode?: string;
  courseTitle?: string;
  currentFeedbackDocument?: UploadedDocument;
  ensureApplicationRow: () => Promise<string>;
  isHero: boolean;
  isProcessing: boolean;
  onNavigate: (path: string) => void;
  onSaveFeedback: (document: UploadedDocument) => Promise<void>;
  onSkipPrompt: (section: Section2EvidenceSectionKey) => void;
  onUnskipPrompt: (section: Section2EvidenceSectionKey) => void;
  plan: Section2EvidencePlan;
  showParsedTranscriptIntro: boolean;
  ungroupedRows: readonly ProgramEvidenceRow[];
}

export function SupportingEvidencePanel({
  assessment,
  courseCode,
  courseTitle,
  currentFeedbackDocument,
  ensureApplicationRow,
  isHero,
  isProcessing,
  onNavigate,
  onSaveFeedback,
  onSkipPrompt,
  onUnskipPrompt,
  plan,
  showParsedTranscriptIntro,
  ungroupedRows,
}: SupportingEvidencePanelProps) {
  const prompt = plan.nextPrompt;

  if (isHero) {
    const heroBullets = prompt?.explanationItems ?? [];
    const startsWithTranscript = !prompt || prompt.sectionKey === "tertiary";

    return (
      <div className="mb-6 rounded-lg border border-[var(--info-border)] bg-white p-4 sm:mb-8 sm:p-5">
        <h2 className="text-sm font-semibold text-gray-900 sm:text-base">
          Supporting Eligibility Documentation
        </h2>
        <p className="mt-1 text-xs text-gray-700 sm:text-sm">
          {courseTitle
            ? `Provide the minimum evidence needed for ${courseTitle}.`
            : "Provide the minimum evidence needed for your selected program."}{" "}
          Upload a document and we&apos;ll read it, draft the details for you, and only ask
          for anything further the program requires.
        </p>
        {programEvidenceAdvisoryCopy.map((paragraph) => (
          <p key={paragraph} className="mt-2 text-xs text-gray-600 sm:text-sm">
            {paragraph}
          </p>
        ))}
        {plan.mode === "requirements" && heroBullets.length > 0 ? (
          <>
            <p className="mt-3 text-xs font-medium text-gray-900 sm:text-sm">
              Start with your academic transcript — one document can verify:
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-gray-700 sm:text-sm">
              {heroBullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-3 text-xs text-gray-700 sm:text-sm">
            We&apos;ll start with your academic transcript, then only prompt you for any
            further evidence that&apos;s still needed.
          </p>
        )}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button
            onClick={() => onNavigate(prompt?.actionPath ?? "/section2/add-tertiary")}
            type="button"
          >
            {startsWithTranscript ? "Upload your transcript" : (prompt?.actionLabel ?? "Add evidence")}
          </Button>
          <Button
            onClick={() => onSkipPrompt(prompt?.sectionKey ?? "tertiary")}
            type="button"
            variant="outline"
          >
            {startsWithTranscript ? "I don't have a transcript" : "Skip for now"}
          </Button>
        </div>
      </div>
    );
  }

  // Courses without published matcher requirements are evaluated by the legacy deterministic
  // engine, whose checks match no catalog requirement — render the assessment's own checks so
  // passing evidence still shows as met cards (and unresolved checks still prompt for action).
  const sourceRows =
    ungroupedRows.length === 0 && assessment
      ? buildAssessmentCheckEvidenceRows(assessment)
      : ungroupedRows;
  const dedupedRows = dedupeProgramEvidenceRowsByHeading(sourceRows);
  const metRows = dedupedRows.filter((row) => row.status === "met");
  const reviewRows = dedupedRows.filter(
    (row) => !row.isBlocking && row.status === "needs_review" && row.requirementStatus,
  );
  const alternativeRows = dedupedRows.filter(
    (row) => row.status === "possible_alternative" && row.requirementStatus,
  );
  const displayedReviewRows = [
    ...reviewRows,
    ...alternativeRows.filter(
      (row) => !plan.suggestion || row.heading !== plan.suggestion.heading,
    ),
  ];
  const feedbackRows: EligibilityFeedbackRow[] = assessment
    ? buildFeedbackRowsFromEvidenceRows([...metRows, ...reviewRows, ...alternativeRows])
    : [];
  // Manual-review flag derives from the same evidence rows that render the cards.
  const transcriptReviewSummary = assessment
    ? buildTranscriptReviewSummary(dedupedRows)
    : undefined;
  const hasAcademicThresholdRequirement = sourceRows.some(
    (row) => row.kindLabel === requirementKindLabel("academic_threshold"),
  );
  const hasQualificationCompletionRequirement = sourceRows.some(
    (row) =>
      row.requiresCompletedQualification ||
      row.kindLabel === requirementKindLabel("qualification_completed"),
  );
  const assessmentEvidenceRows = assessment
    ? buildAssessmentEvidenceRows(assessment).filter((row) => {
        if (hasAcademicThresholdRequirement && row.id === "academic-result") {
          return false;
        }
        if (hasQualificationCompletionRequirement && row.id === "completion-status") {
          return false;
        }
        return true;
      })
    : [];

  const hasReviewOutcome =
    Boolean(transcriptReviewSummary?.manualReviewNeeded) || alternativeRows.length > 0;
  const summary = hasReviewOutcome
    ? "Needs review"
    : plan.isEvidenceReady
    ? "Evidence ready"
    : plan.remainingPromptCount > 0
      ? `${plan.remainingPromptCount} item${plan.remainingPromptCount === 1 ? "" : "s"} to add`
      : plan.skippedPrompts.length > 0
        ? `${plan.skippedPrompts.length} item${plan.skippedPrompts.length === 1 ? "" : "s"} skipped`
        : "Needs review";
  const summaryTone = plan.isEvidenceReady && !hasReviewOutcome
    ? "text-[var(--success-text)]"
    : "text-[var(--warning-text)]";

  return (
    <div className="mb-6 rounded-lg border border-[var(--info-border)] bg-white p-4 sm:mb-8 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold text-gray-900 sm:text-base">
          Supporting Eligibility Documentation
        </h2>
        <p className={`text-xs font-semibold sm:text-sm ${summaryTone}`}>{summary}</p>
      </div>
      {showParsedTranscriptIntro ? (
        <p className="mt-2 text-xs text-gray-700 sm:text-sm">
          Based on your uploaded transcript, we&apos;ve reviewed your eligibility
          {courseTitle ? ` for ${courseTitle}` : ""}.
        </p>
      ) : null}
      {programEvidenceAdvisoryCopy.map((paragraph) => (
        <p key={paragraph} className="mt-2 text-xs text-gray-600 sm:text-sm">
          {paragraph}
        </p>
      ))}
      {assessmentEvidenceRows.length > 0 ? (
        <ul className="mt-3 space-y-2" aria-label="Transcript evidence extracted">
          {assessmentEvidenceRows.map((row) => (
            <EvidenceReviewRow
              key={row.id}
              explanation={row.explanation}
              heading={row.sourceText}
            />
          ))}
        </ul>
      ) : null}
      {metRows.length > 0 ? (
        <ul className="mt-3 space-y-2" aria-label="Evidence satisfied">
          {metRows.map((row) => (
            <li
              key={row.id}
              className="rounded-md border border-[var(--success-border)] bg-[var(--success-bg)] p-3"
            >
              <p className="text-xs font-semibold text-gray-900 sm:text-sm">
                {row.heading}
                <span className="ml-2 font-medium text-[var(--success-text)]">Met</span>
              </p>
              <p className="mt-1 text-xs text-gray-700 sm:text-sm">{row.explanation}</p>
            </li>
          ))}
        </ul>
      ) : null}
      {displayedReviewRows.length > 0 ? (
        <ul className="mt-3 space-y-2" aria-label="Evidence needing review">
          {displayedReviewRows.map((row) => (
            <EvidenceReviewRow
              key={row.id}
              explanation={row.explanation}
              heading={row.heading}
            />
          ))}
        </ul>
      ) : null}
      {assessment && feedbackRows.length > 0 ? (
        <div className="mt-3" aria-label="Transcript feedback">
          <EligibilityFeedbackForm
            courseCode={courseCode}
            courseTitle={courseTitle}
            currentDocument={currentFeedbackDocument}
            ensureApplicationRow={ensureApplicationRow}
            modelId={assessment.modelId}
            onSaveFeedback={onSaveFeedback}
            promptVersion={assessment.promptVersion}
            rows={feedbackRows}
            rulesVersion={assessment.rulesVersion}
            schemaVersion={assessment.schemaVersion}
            serviceVersion={assessment.serviceVersion}
          />
        </div>
      ) : null}
      {!isProcessing && !prompt && plan.suggestion ? (
        <ul className="mt-3 space-y-2" aria-label="Optional evidence suggestion">
          <EvidenceReviewRow
            action={
              <Button
                onClick={() => onNavigate(plan.suggestion!.actionPath)}
                type="button"
              >
                {plan.suggestion.actionLabel}
              </Button>
            }
            explanation={plan.suggestion.explanation}
            heading={plan.suggestion.heading}
          />
        </ul>
      ) : null}
      {!isProcessing && !prompt && plan.skippedPrompts.length > 0 ? (
        <div className="mt-3 rounded-md border border-[var(--warning-border)] bg-[var(--warning-bg)] p-3">
          <p className="text-xs font-semibold text-[var(--warning-text)] sm:text-sm">
            You skipped {plan.skippedPrompts.length} evidence item
            {plan.skippedPrompts.length === 1 ? "" : "s"}. Admissions may follow up if
            they&apos;re required.
          </p>
          <ul className="mt-2 space-y-2">
            {plan.skippedPrompts.map((skipped) => (
              <li
                key={skipped.sectionKey}
                className="flex items-center justify-between gap-2"
              >
                <span className="text-xs text-[var(--warning-text)] sm:text-sm">
                  {skipped.heading}
                </span>
                <Button
                  className="h-8 px-3 text-xs"
                  onClick={() => onUnskipPrompt(skipped.sectionKey)}
                  type="button"
                  variant="outline"
                >
                  Restore
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {transcriptReviewSummary?.manualReviewNeeded ? (
        <p className="mt-2 text-xs font-medium text-[var(--warning-text)] sm:text-sm">
          Manual admissions review is required for one or more evidence checks.
        </p>
      ) : null}
    </div>
  );
}
