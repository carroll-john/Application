import { FileSearch } from "lucide-react";
import { StatusPill } from "../../components/StatusPill";
import type { UcCreditAssessmentResult } from "../../lib/ucCreditAssessment";

const CONFIDENCE_TONE = {
  high: "success",
  low: "neutral",
  medium: "warning",
} as const;

export function UcCreditAssessmentComparison({
  result,
}: {
  result: UcCreditAssessmentResult;
}) {
  return (
    <div className="mx-5 mb-5 rounded-[22px] bg-green-50/80 p-5 ring-1 ring-green-200 sm:mx-6 sm:mb-6 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-green-950">
            Indicative credit guidance
          </p>
          <p className="mt-1 text-sm leading-6 text-green-900/80">
            {result.evidenceSummary}
          </p>
        </div>
        <StatusPill
          className="px-2.5 py-1 text-xs"
          tone={CONFIDENCE_TONE[result.confidence]}
        >
          {result.confidence === "high"
            ? "High confidence"
            : result.confidence === "medium"
              ? "Medium confidence"
              : "Manual review"}
        </StatusPill>
      </div>

      <div className="mt-5 rounded-[18px] border border-green-300 bg-white p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-green-950">
          <FileSearch className="h-4 w-4 text-green-700" aria-hidden="true" />
          {result.potentialCreditPoints === null
            ? "Credit points need UC review"
            : `Up to ${result.potentialCreditPoints} credit points`}
        </p>
        {result.publishedCap !== null ? (
          <p className="mt-2 text-xs leading-5 text-slate-600">
            Published course cap: {result.publishedCap} credit points. This is not
            an admission offer or formal credit decision.
          </p>
        ) : null}
      </div>

      {result.matchedTranscriptEvidence.length > 0 ? (
        <ul className="mt-4 space-y-2 text-sm text-green-950">
          {result.matchedTranscriptEvidence.map((evidence) => (
            <li key={`${evidence.mappingId}-${evidence.unitCode ?? evidence.title}`}>
              {evidence.unitCode ? `${evidence.unitCode}: ` : ""}
              {evidence.title}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
