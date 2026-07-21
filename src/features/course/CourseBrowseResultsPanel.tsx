import { StatusPill } from "../../components/StatusPill";
import { SurfaceCard } from "../../components/SurfaceCard";
import { Button } from "../../components/ui/button";
import type { CourseBrowseResultsState } from "../../lib/courseBrowse";

interface CourseBrowseResultsPanelProps {
  onClearFilters: () => void;
  resultsState: CourseBrowseResultsState;
}

export function CourseBrowseResultsPanel({
  onClearFilters,
  resultsState,
}: CourseBrowseResultsPanelProps) {
  return (
    <SurfaceCard className="mt-4 border-[var(--border)] bg-[var(--background-tinted)] p-4 sm:p-5">
      <div
        aria-live="polite"
        className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--cta-tertiary-text)]">
            {resultsState.headline}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            {resultsState.detail}
          </p>
          {resultsState.activeFilters.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {resultsState.activeFilters.map((filter) => (
                <StatusPill
                  key={filter.label}
                  className="px-2.5 py-1 text-xs"
                  tone={filter.id === "search" ? "info" : "neutral"}
                >
                  {filter.label}
                </StatusPill>
              ))}
            </div>
          ) : null}
        </div>
        {resultsState.hasActiveFilters ? (
          <Button
            className="sm:shrink-0"
            size="sm"
            type="button"
            variant="neutralOutline"
            onClick={onClearFilters}
          >
            Clear filters
          </Button>
        ) : null}
      </div>
    </SurfaceCard>
  );
}
