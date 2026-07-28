import { ArrowRight, Clock3, WalletCards } from "lucide-react";
import { StatusPill } from "../../components/StatusPill";
import {
  formatUcAssessmentCost,
  formatUcAssessmentDuration,
  type UcCreditAssessmentResult,
} from "../../lib/ucCreditAssessment";

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
  const originalDuration = formatUcAssessmentDuration(
    result.originalDurationMonths,
  );
  const afterDuration = formatUcAssessmentDuration(result.afterDurationMonths);
  const originalCost = formatUcAssessmentCost(result.originalCost);
  const afterCost = formatUcAssessmentCost(result.afterCost);

  return (
    <div className="mx-5 mb-5 rounded-[22px] bg-green-50/80 p-5 ring-1 ring-green-200 sm:mx-6 sm:mb-6 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-green-950">
            Your indicative credit assessment
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
              : "Faculty review"}
        </StatusPill>
      </div>

      <div className="mt-5 grid items-stretch gap-2 sm:grid-cols-[1fr_auto_1fr]">
        <div className="rounded-[18px] border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Original
          </p>
          <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Clock3 className="h-4 w-4 text-slate-500" aria-hidden="true" />
            {originalDuration}
          </p>
          <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <WalletCards className="h-4 w-4 text-slate-500" aria-hidden="true" />
            {originalCost}
          </p>
        </div>

        <span className="flex items-center justify-center text-[var(--sn-mint)]">
          <ArrowRight className="h-5 w-5 rotate-90 sm:rotate-0" aria-hidden="true" />
          <span className="sr-only">compared with</span>
        </span>

        <div className="rounded-[18px] border border-green-300 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-green-800">
            After credit
          </p>
          <p className="mt-3 flex items-center gap-2 text-sm font-bold text-green-950">
            <Clock3 className="h-4 w-4 text-green-700" aria-hidden="true" />
            {afterDuration}
          </p>
          <p className="mt-2 flex items-center gap-2 text-sm font-bold text-green-950">
            <WalletCards className="h-4 w-4 text-green-700" aria-hidden="true" />
            {afterCost}
          </p>
        </div>
      </div>

      {result.potentialCreditPoints > 0 ? (
        <p className="mt-4 text-sm font-semibold text-green-950">
          Up to {result.potentialCreditPoints} credit points indicated
        </p>
      ) : null}
    </div>
  );
}
