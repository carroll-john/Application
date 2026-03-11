import {
  BarChart3,
  ChevronLeft,
  Clock3,
  Filter,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppBrandHeader } from "../components/AppBrandHeader";
import { StatusPill } from "../components/StatusPill";
import { SurfaceCard } from "../components/SurfaceCard";
import { Button } from "../components/ui/button";
import { useAuth } from "../context/AuthContext";
import {
  buildPilotEvaluationDashboard,
  type PilotEvaluationMetricTrendPoint,
  type PilotEvaluationMetricView,
} from "../lib/pilotEvaluationDashboard";
import { loadPilotTelemetryEvents, type PilotMetricDefinition } from "../lib/pilotTelemetry";
import {
  loadPilotTelemetryRollups,
  syncScheduledPilotTelemetryRollups,
  type PilotTelemetryRollupSnapshot,
} from "../lib/pilotTelemetryRollups";

function formatTimestamp(value: string | undefined): string {
  if (!value) {
    return "Not yet";
  }

  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatAdapterModeLabel(adapterMode: string): string {
  switch (adapterMode) {
    case "api":
      return "API adapter";
    case "edge-local":
      return "Edge connector";
    case "file":
      return "File adapter";
    case "import-workflow":
      return "Import workflow";
    case "not-applicable":
      return "Upstream-only";
    case "portal-rpa":
      return "Portal RPA";
    default:
      return adapterMode;
  }
}

function formatMetricValue(
  definition: PilotMetricDefinition,
  value: number | null,
): string {
  if (value === null) {
    return "No data yet";
  }

  switch (definition.unit) {
    case "hours":
      return `${value.toFixed(1)} hrs`;
    case "rate":
      return `${(value * 100).toFixed(1)}%`;
    case "reviewers":
      return `${Math.round(value)}`;
    case "count":
      return `${Math.round(value)}`;
  }
}

function formatMetricDelta(
  definition: PilotMetricDefinition,
  deltaValue: number | null,
): string {
  if (deltaValue === null) {
    return "No prior checkpoint";
  }

  if (deltaValue === 0) {
    return "No change";
  }

  const direction = deltaValue > 0 ? "Up" : "Down";

  switch (definition.unit) {
    case "hours":
      return `${direction} ${Math.abs(deltaValue).toFixed(1)} hrs`;
    case "rate":
      return `${direction} ${(Math.abs(deltaValue) * 100).toFixed(1)} pts`;
    case "reviewers":
      return `${direction} ${Math.round(Math.abs(deltaValue))} reviewer${
        Math.round(Math.abs(deltaValue)) === 1 ? "" : "s"
      }`;
    case "count":
      return `${direction} ${Math.round(Math.abs(deltaValue))}`;
  }
}

function buildSparklineColumns(points: PilotEvaluationMetricTrendPoint[]) {
  const visiblePoints = points.slice(-8);
  const numericValues = visiblePoints
    .map((point) => point.value)
    .filter((value): value is number => value !== null);
  const minimum = numericValues.length > 0 ? Math.min(...numericValues) : 0;
  const maximum = numericValues.length > 0 ? Math.max(...numericValues) : 0;
  const span = Math.max(1, maximum - minimum);

  return visiblePoints.map((point) => {
    if (point.value === null) {
      return {
        ...point,
        height: 16,
      };
    }

    return {
      ...point,
      height: Math.max(16, 16 + ((point.value - minimum) / span) * 44),
    };
  });
}

function TrendSparkline({
  definition,
  points,
}: {
  definition: PilotMetricDefinition;
  points: PilotEvaluationMetricTrendPoint[];
}) {
  const columns = buildSparklineColumns(points);

  if (columns.length === 0) {
    return (
      <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
        Waiting for checkpoint history.
      </div>
    );
  }

  return (
    <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex h-16 items-end gap-1.5">
        {columns.map((column) => (
          <div key={column.snapshotId} className="flex min-w-0 flex-1 flex-col items-center">
            <div
              className="w-full rounded-full bg-[#0B4F74]"
              style={{ height: `${column.height}px` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-slate-500">
        <span>{columns.length} checkpoints</span>
        <span>{definition.label}</span>
      </div>
    </div>
  );
}

function MetricTile({ metric }: { metric: PilotEvaluationMetricView }) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-[18rem]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {metric.definition.label}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {metric.definition.description}
          </p>
        </div>
        <StatusPill tone={metric.trendDirection === "flat" ? "neutral" : "info"}>
          {formatMetricDelta(metric.definition, metric.deltaValue)}
        </StatusPill>
      </div>
      <p className="mt-6 text-3xl font-bold text-slate-950">
        {formatMetricValue(metric.definition, metric.currentValue)}
      </p>
      <p className="mt-2 text-sm text-slate-600">{metric.detail}</p>
      <div className="mt-5">
        <TrendSparkline definition={metric.definition} points={metric.trendPoints} />
      </div>
    </div>
  );
}

function MetricSummaryCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <SurfaceCard className="rounded-[28px] p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="rounded-full bg-[#E8F1F6] p-3 text-[#0B4F74]">{icon}</div>
        <p className="text-right text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          {label}
        </p>
      </div>
      <p className="mt-5 text-2xl font-bold text-slate-950">{value}</p>
    </SurfaceCard>
  );
}

export default function AdmissionsPilotDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { companyUserDisplayName, signOut } = useAuth();
  const [telemetryEvents] = useState(() => loadPilotTelemetryEvents());
  const [rollupSnapshots, setRollupSnapshots] = useState<PilotTelemetryRollupSnapshot[]>(
    () => loadPilotTelemetryRollups(),
  );

  useEffect(() => {
    if (telemetryEvents.length > 0) {
      syncScheduledPilotTelemetryRollups({
        events: telemetryEvents,
      });
    }

    setRollupSnapshots(loadPilotTelemetryRollups());
  }, [telemetryEvents]);

  const filters = useMemo(
    () => ({
      adapterMode:
        searchParams.get("adapter") && searchParams.get("adapter") !== "all"
          ? searchParams.get("adapter") ?? undefined
          : undefined,
      partnerName:
        searchParams.get("partner") && searchParams.get("partner") !== "all"
          ? searchParams.get("partner") ?? undefined
          : undefined,
    }),
    [searchParams],
  );
  const dashboard = useMemo(
    () =>
      buildPilotEvaluationDashboard({
        events: telemetryEvents,
        filters,
        snapshots: rollupSnapshots,
      }),
    [filters, rollupSnapshots, telemetryEvents],
  );

  const updateFilters = (patch: { adapterMode?: string; partnerName?: string }) => {
    const nextParams = new URLSearchParams(searchParams);

    if (patch.partnerName !== undefined) {
      if (!patch.partnerName || patch.partnerName === "all") {
        nextParams.delete("partner");
      } else {
        nextParams.set("partner", patch.partnerName);
      }
    }

    if (patch.adapterMode !== undefined) {
      if (!patch.adapterMode || patch.adapterMode === "all") {
        nextParams.delete("adapter");
      } else {
        nextParams.set("adapter", patch.adapterMode);
      }
    }

    setSearchParams(nextParams, { replace: true });
  };

  if (!dashboard.latestSnapshot) {
    return (
      <div className="min-h-screen bg-[#f7f7f4]">
        <AppBrandHeader variant="admissions">
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => navigate("/admissions")} variant="outline">
              <ChevronLeft className="h-4 w-4" />
              Back to queue
            </Button>
            <Button
              onClick={async () => {
                await signOut();
                navigate("/sign-in", { replace: true });
              }}
              variant="outline"
            >
              Log out
            </Button>
          </div>
        </AppBrandHeader>

        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
          <SurfaceCard className="rounded-[32px] p-10 text-center">
            <h1 className="text-3xl font-bold text-slate-950">
              Pilot evaluation dashboard
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              No telemetry checkpoints have been recorded yet. Start from the
              admissions queue and capture reviewer activity or decisions before
              reviewing pilot metrics.
            </p>
            <Button className="mt-6" onClick={() => navigate("/admissions")}>
              Return to admissions workspace
            </Button>
          </SurfaceCard>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f4]">
      <AppBrandHeader variant="admissions">
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => navigate("/admissions")} variant="outline">
            <ChevronLeft className="h-4 w-4" />
            Back to queue
          </Button>
          <Button
            onClick={async () => {
              await signOut();
              navigate("/sign-in", { replace: true });
            }}
            variant="outline"
          >
            Log out
          </Button>
        </div>
      </AppBrandHeader>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Pilot evaluation dashboard
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950 sm:text-4xl">
              Viability, feasibility, and desirability checkpoints
            </h1>
            <p className="mt-3 text-base leading-7 text-slate-600">
              Review filtered pilot performance across the admissions workspace,
              downstream adapter routes, and checkpoint history. Signed in as{" "}
              {companyUserDisplayName}.
            </p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600">
            Latest checkpoint{" "}
            <span className="font-semibold text-slate-950">
              {formatTimestamp(dashboard.latestSnapshot.generatedAt)}
            </span>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricSummaryCard
            icon={<Clock3 className="h-5 w-5" />}
            label="Stored checkpoints"
            value={String(dashboard.snapshotCount)}
          />
          <MetricSummaryCard
            icon={<BarChart3 className="h-5 w-5" />}
            label="Filtered segments"
            value={String(dashboard.latestSegments.length)}
          />
          <MetricSummaryCard
            icon={<Users className="h-5 w-5" />}
            label="Weekly active reviewers"
            value={String(dashboard.currentSummary.weeklyActiveReviewers)}
          />
          <MetricSummaryCard
            icon={<ShieldCheck className="h-5 w-5" />}
            label="Rollup consistency"
            value={
              dashboard.latestSnapshot.consistency.passed
                ? "Passing"
                : `${dashboard.latestSnapshot.consistency.issueCount} issues`
            }
          />
        </div>

        <SurfaceCard className="mt-8 rounded-[32px] p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Filters
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">
                Segment the pilot by university and adapter path
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Use these filters to review the latest checkpoint and the trend
                history for a specific partner cohort or delivery path.
              </p>
            </div>
            <Button
              onClick={() => {
                setSearchParams(new URLSearchParams(), { replace: true });
              }}
              size="sm"
              variant="outline"
            >
              Reset filters
            </Button>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                University
              </span>
              <select
                className="rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                onChange={(event) =>
                  updateFilters({ partnerName: event.target.value })
                }
                value={filters.partnerName ?? "all"}
              >
                <option value="all">All universities</option>
                {dashboard.partnerOptions.map((partnerName) => (
                  <option key={partnerName} value={partnerName}>
                    {partnerName}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Adapter path
              </span>
              <select
                className="rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                onChange={(event) =>
                  updateFilters({ adapterMode: event.target.value })
                }
                value={filters.adapterMode ?? "all"}
              >
                <option value="all">All adapter paths</option>
                {dashboard.adapterOptions.map((adapterMode) => (
                  <option key={adapterMode} value={adapterMode}>
                    {formatAdapterModeLabel(adapterMode)}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <Filter className="h-4 w-4" />
                {filters.partnerName || filters.adapterMode
                  ? "Filtered cohort"
                  : "All pilot cohorts"}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {dashboard.latestSegments.length > 0 ? (
              dashboard.latestSegments.map((segment) => (
                <div
                  key={segment.segmentId}
                  className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700"
                >
                  <span className="font-medium text-slate-950">
                    {segment.partnerName}
                  </span>{" "}
                  · {segment.courseCode} · {formatAdapterModeLabel(segment.adapterMode)}
                </div>
              ))
            ) : (
              <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                No checkpoint segments match the current filters yet.
              </div>
            )}
          </div>
        </SurfaceCard>

        <div className="mt-8 grid gap-6 xl:grid-cols-3">
          {dashboard.categoryViews.map((category) => (
            <SurfaceCard key={category.category} className="rounded-[32px] p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {category.title}
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">
                {category.title} metrics
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {category.description}
              </p>
              <div className="mt-6 grid gap-4">
                {category.metrics.map((metric) => (
                  <MetricTile key={metric.definition.key} metric={metric} />
                ))}
              </div>
            </SurfaceCard>
          ))}
        </div>

        <SurfaceCard className="mt-8 rounded-[32px] p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Checkpoint trend view
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">
                Review-ready checkpoint history
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Each row captures the filtered pilot state at a stored checkpoint so
                week-by-week reviews can compare consistency, throughput, and
                operator adoption without re-querying raw events manually.
              </p>
            </div>
            <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Showing {dashboard.checkpointRows.length} most recent checkpoints
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <th className="pb-3 pr-4">Checkpoint</th>
                  <th className="pb-3 pr-4">Decision cycle</th>
                  <th className="pb-3 pr-4">Handoff rate</th>
                  <th className="pb-3 pr-4">Provisioning success</th>
                  <th className="pb-3 pr-4">Active reviewers</th>
                  <th className="pb-3 pr-4">Consistency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm text-slate-700">
                {dashboard.checkpointRows.map((row) => (
                  <tr key={row.snapshotId}>
                    <td className="py-4 pr-4">
                      <div>
                        <p className="font-medium text-slate-950">
                          {formatTimestamp(row.generatedAt)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {row.segmentCount} segment{row.segmentCount === 1 ? "" : "s"}
                        </p>
                      </div>
                    </td>
                    <td className="py-4 pr-4">
                      {formatMetricValue(
                        dashboard.categoryViews[0].metrics.find(
                          (metric) =>
                            metric.definition.key === "decision_cycle_time_hours",
                        )!.definition,
                        row.metrics.decision_cycle_time_hours,
                      )}
                    </td>
                    <td className="py-4 pr-4">
                      {formatMetricValue(
                        dashboard.categoryViews[0].metrics.find(
                          (metric) =>
                            metric.definition.key === "approved_decision_handoff_rate",
                        )!.definition,
                        row.metrics.approved_decision_handoff_rate,
                      )}
                    </td>
                    <td className="py-4 pr-4">
                      {formatMetricValue(
                        dashboard.categoryViews[1].metrics.find(
                          (metric) =>
                            metric.definition.key ===
                            "provisioning_success_rate_by_adapter",
                        )!.definition,
                        row.metrics.provisioning_success_rate_by_adapter,
                      )}
                    </td>
                    <td className="py-4 pr-4">
                      {formatMetricValue(
                        dashboard.categoryViews[2].metrics.find(
                          (metric) =>
                            metric.definition.key === "weekly_active_reviewers",
                        )!.definition,
                        row.metrics.weekly_active_reviewers,
                      )}
                    </td>
                    <td className="py-4 pr-4">
                      <StatusPill tone={row.status === "passing" ? "success" : "warning"}>
                        {row.status === "passing"
                          ? "Passing"
                          : `${row.issueCount} issue${row.issueCount === 1 ? "" : "s"}`}
                      </StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}
