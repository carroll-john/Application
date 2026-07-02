import { Button } from "../../components/ui/button";
import { SurfaceCard } from "../../components/SurfaceCard";
import type { OverviewActionDescriptor } from "../../lib/overviewAction";

interface OverviewContinuePanelProps {
  nextAction: OverviewActionDescriptor;
  onContinue: () => void;
}

export function OverviewContinuePanel({
  nextAction,
  onContinue,
}: OverviewContinuePanelProps) {
  return (
    <>
      <SurfaceCard className="mt-6 border-[#084E74]/10 bg-[#EAF1F5] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#084E74]">
              <span>{nextAction.label}</span>
              {nextAction.sectionLabel ? (
                <span className="rounded-full border border-[#084E74]/20 bg-white px-3 py-1 tracking-[0.12em] text-[#084E74]">
                  {nextAction.sectionLabel}
                </span>
              ) : null}
            </div>
            <h2 className="mt-3 text-2xl font-bold text-slate-900">
              {nextAction.title}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-700 sm:text-base">
              {nextAction.description}
            </p>
          </div>
          <div className="hidden shrink-0 sm:block">
            <Button className="w-full sm:w-auto" onClick={onContinue}>
              {nextAction.primaryLabel}
            </Button>
          </div>
        </div>
      </SurfaceCard>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 p-4 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:hidden">
        <Button className="w-full" onClick={onContinue}>
          {nextAction.primaryLabel}
        </Button>
      </div>
    </>
  );
}
