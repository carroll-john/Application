import {
  buildAdmissionsPilotTelemetrySummary,
  listPilotMetricDefinitions,
  type AdmissionsPilotTelemetrySummary,
  type PilotMetricCategory,
  type PilotMetricDefinition,
  type PilotMetricKey,
  type PilotTelemetryEventRecord,
} from "./pilotTelemetry";
import {
  getPilotTelemetryRollupMetric,
  listPilotTelemetryRollupSegments,
  type PilotTelemetryRollupFilter,
  type PilotTelemetryRollupMetricValue,
  type PilotTelemetryRollupSegment,
  type PilotTelemetryRollupSnapshot,
} from "./pilotTelemetryRollups";

const CATEGORY_ORDER: readonly PilotMetricCategory[] = [
  "viability",
  "feasibility",
  "desirability",
];
const CHECKPOINT_ROW_LIMIT = 6;

const CATEGORY_METADATA: Record<
  PilotMetricCategory,
  { description: string; title: string }
> = {
  desirability: {
    description:
      "Measures whether admissions teams keep using the workspace and protected document flow during the pilot.",
    title: "Desirability",
  },
  feasibility: {
    description:
      "Shows downstream delivery reliability and reconciliation quality across the active adapter paths.",
    title: "Feasibility",
  },
  viability: {
    description:
      "Tracks whether upstream decisioning improves turnaround and keeps approved outcomes moving downstream.",
    title: "Viability",
  },
};

type DashboardTrendDirection = "down" | "flat" | "none" | "up";

interface ResolvedMetricAggregate {
  denominator?: number;
  numerator?: number;
  sampleSize: number;
  value: number | null;
}

export interface PilotEvaluationDashboardFilters {
  adapterMode?: string;
  partnerName?: string;
}

export interface PilotEvaluationMetricTrendPoint {
  generatedAt: string;
  snapshotId: string;
  value: number | null;
}

export interface PilotEvaluationMetricView {
  currentValue: number | null;
  definition: PilotMetricDefinition;
  deltaValue: number | null;
  detail: string;
  previousValue: number | null;
  trendDirection: DashboardTrendDirection;
  trendPoints: PilotEvaluationMetricTrendPoint[];
}

export interface PilotEvaluationCategoryView {
  category: PilotMetricCategory;
  description: string;
  metrics: PilotEvaluationMetricView[];
  title: string;
}

export interface PilotEvaluationCheckpointRow {
  generatedAt: string;
  issueCount: number;
  metrics: Record<PilotMetricKey, number | null>;
  segmentCount: number;
  snapshotId: string;
  status: "attention" | "passing";
}

export interface PilotEvaluationDashboardModel {
  adapterOptions: string[];
  categoryViews: PilotEvaluationCategoryView[];
  checkpointRows: PilotEvaluationCheckpointRow[];
  currentSummary: AdmissionsPilotTelemetrySummary;
  latestSegments: PilotTelemetryRollupSegment[];
  latestSnapshot?: PilotTelemetryRollupSnapshot;
  partnerOptions: string[];
  snapshotCount: number;
}

function sortSnapshots(
  snapshots: PilotTelemetryRollupSnapshot[],
): PilotTelemetryRollupSnapshot[] {
  return [...snapshots].sort((left, right) =>
    left.generatedAt.localeCompare(right.generatedAt),
  );
}

function buildSummaryForSnapshot(
  events: PilotTelemetryEventRecord[],
  filters: PilotEvaluationDashboardFilters,
  snapshot: PilotTelemetryRollupSnapshot | undefined,
): AdmissionsPilotTelemetrySummary {
  return buildAdmissionsPilotTelemetrySummary(events, {
    adapterMode: filters.adapterMode,
    partnerName: filters.partnerName,
    until: snapshot?.sourceWindowEnd ?? snapshot?.generatedAt,
  });
}

function buildRollupFilters(
  filters: PilotEvaluationDashboardFilters,
): PilotTelemetryRollupFilter {
  return {
    adapterMode: filters.adapterMode,
    partnerName: filters.partnerName,
  };
}

function listDistinctValues(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())))]
    .sort((left, right) => left.localeCompare(right));
}

function listMetricDefinitionsByCategory(
  category: PilotMetricCategory,
): PilotMetricDefinition[] {
  return [...listPilotMetricDefinitions(category)].sort((left, right) =>
    left.label.localeCompare(right.label),
  );
}

function roundMetricValue(
  unit: PilotMetricDefinition["unit"],
  value: number | null,
): number | null {
  if (value === null) {
    return null;
  }

  switch (unit) {
    case "hours":
      return Number(value.toFixed(2));
    case "rate":
      return Number(value.toFixed(4));
    case "reviewers":
      return Math.round(value);
    case "count":
      return Math.round(value);
  }
}

function aggregateRollupMetric(
  segments: PilotTelemetryRollupSegment[],
  definition: PilotMetricDefinition,
): ResolvedMetricAggregate {
  const metrics = segments
    .map((segment) => getPilotTelemetryRollupMetric(segment, definition.key))
    .filter((metric): metric is PilotTelemetryRollupMetricValue => Boolean(metric));

  if (metrics.length === 0) {
    return {
      sampleSize: 0,
      value: null,
    };
  }

  if (definition.unit === "hours") {
    const weightedSamples = metrics.filter(
      (metric): metric is PilotTelemetryRollupMetricValue & {
        sampleSize: number;
        value: number;
      } =>
        metric.value !== null &&
        typeof metric.value === "number" &&
        typeof metric.sampleSize === "number" &&
        metric.sampleSize > 0,
    );
    const sampleSize = weightedSamples.reduce(
      (total, metric) => total + metric.sampleSize,
      0,
    );

    if (sampleSize === 0) {
      return {
        sampleSize: 0,
        value: null,
      };
    }

    const weightedTotal = weightedSamples.reduce(
      (total, metric) => total + metric.value * metric.sampleSize,
      0,
    );

    return {
      sampleSize,
      value: roundMetricValue(definition.unit, weightedTotal / sampleSize),
    };
  }

  if (definition.unit === "rate") {
    const numerator = metrics.reduce(
      (total, metric) => total + (metric.numerator ?? 0),
      0,
    );
    const denominator = metrics.reduce(
      (total, metric) => total + (metric.denominator ?? 0),
      0,
    );

    return {
      denominator,
      numerator,
      sampleSize: denominator,
      value:
        denominator > 0
          ? roundMetricValue(definition.unit, numerator / denominator)
          : null,
    };
  }

  const total = metrics.reduce(
    (sum, metric) => sum + (metric.value ?? 0),
    0,
  );

  return {
    sampleSize: total,
    value: roundMetricValue(definition.unit, total),
  };
}

function resolveMetricAggregate(
  definition: PilotMetricDefinition,
  snapshot: PilotTelemetryRollupSnapshot | undefined,
  events: PilotTelemetryEventRecord[],
  filters: PilotEvaluationDashboardFilters,
): ResolvedMetricAggregate {
  const summary = buildSummaryForSnapshot(events, filters, snapshot);

  switch (definition.key) {
    case "decision_cycle_time_hours":
      return {
        sampleSize: summary.decisionCount,
        value: roundMetricValue(definition.unit, summary.medianTimeToDecisionHours),
      };
    case "weekly_active_reviewers":
      return {
        sampleSize: summary.weeklyActiveReviewers,
        value: roundMetricValue(definition.unit, summary.weeklyActiveReviewers),
      };
    default:
      return aggregateRollupMetric(
        listPilotTelemetryRollupSegments(snapshot, buildRollupFilters(filters)),
        definition,
      );
  }
}

function buildMetricDetail(
  definition: PilotMetricDefinition,
  aggregate: ResolvedMetricAggregate,
): string {
  switch (definition.key) {
    case "decision_cycle_time_hours":
      return aggregate.sampleSize > 0
        ? `${aggregate.sampleSize} decision sample${aggregate.sampleSize === 1 ? "" : "s"}`
        : "No decision samples yet";
    case "approved_decision_handoff_rate":
      return aggregate.denominator
        ? `${aggregate.numerator ?? 0}/${aggregate.denominator} approved decisions handed off`
        : "No approved decisions yet";
    case "provisioning_success_rate_by_adapter":
      return aggregate.denominator
        ? `${aggregate.numerator ?? 0}/${aggregate.denominator} triggered handoffs completed`
        : "No triggered provisioning handoffs yet";
    case "reconciliation_match_rate":
      return aggregate.denominator
        ? `${aggregate.numerator ?? 0}/${aggregate.denominator} triggered handoffs reconciled`
        : "No reconciliation samples yet";
    case "weekly_active_reviewers":
      return aggregate.sampleSize > 0
        ? `${aggregate.sampleSize} unique reviewers in the trailing 7-day window`
        : "No reviewer activity in the trailing 7-day window";
    case "secure_document_view_success_rate":
      return aggregate.denominator
        ? `${aggregate.numerator ?? 0}/${aggregate.denominator} protected previews opened`
        : "No protected preview activity yet";
  }
}

function buildTrendDirection(deltaValue: number | null): DashboardTrendDirection {
  if (deltaValue === null) {
    return "none";
  }

  if (deltaValue === 0) {
    return "flat";
  }

  return deltaValue > 0 ? "up" : "down";
}

function buildMetricView(
  definition: PilotMetricDefinition,
  snapshots: PilotTelemetryRollupSnapshot[],
  events: PilotTelemetryEventRecord[],
  filters: PilotEvaluationDashboardFilters,
): PilotEvaluationMetricView {
  const trendPoints = snapshots.map((snapshot) => ({
    generatedAt: snapshot.generatedAt,
    snapshotId: snapshot.snapshotId,
    value: resolveMetricAggregate(definition, snapshot, events, filters).value,
  }));
  const currentAggregate = resolveMetricAggregate(
    definition,
    snapshots.at(-1),
    events,
    filters,
  );
  const previousAggregate = resolveMetricAggregate(
    definition,
    snapshots.at(-2),
    events,
    filters,
  );
  const deltaValue =
    currentAggregate.value !== null && previousAggregate.value !== null
      ? roundMetricValue(
          definition.unit,
          currentAggregate.value - previousAggregate.value,
        )
      : null;

  return {
    currentValue: currentAggregate.value,
    definition,
    deltaValue,
    detail: buildMetricDetail(definition, currentAggregate),
    previousValue: previousAggregate.value,
    trendDirection: buildTrendDirection(deltaValue),
    trendPoints,
  };
}

function buildCheckpointRow(
  snapshot: PilotTelemetryRollupSnapshot,
  events: PilotTelemetryEventRecord[],
  filters: PilotEvaluationDashboardFilters,
): PilotEvaluationCheckpointRow {
  const metrics = Object.fromEntries(
    CATEGORY_ORDER.flatMap((category) =>
      listMetricDefinitionsByCategory(category).map((definition) => [
        definition.key,
        buildMetricView(definition, [snapshot], events, filters).currentValue,
      ]),
    ),
  ) as Record<PilotMetricKey, number | null>;

  return {
    generatedAt: snapshot.generatedAt,
    issueCount: snapshot.consistency.issueCount,
    metrics,
    segmentCount: listPilotTelemetryRollupSegments(
      snapshot,
      buildRollupFilters(filters),
    ).length,
    snapshotId: snapshot.snapshotId,
    status: snapshot.consistency.passed ? "passing" : "attention",
  };
}

export function listPilotEvaluationPartnerOptions(input: {
  events: PilotTelemetryEventRecord[];
  snapshots: PilotTelemetryRollupSnapshot[];
}): string[] {
  return listDistinctValues([
    ...input.snapshots.flatMap((snapshot) =>
      snapshot.segments.map((segment) => segment.partnerName),
    ),
    ...input.events.map((event) =>
      typeof event.properties.pilot_partner_name === "string"
        ? event.properties.pilot_partner_name
        : undefined,
    ),
  ]);
}

export function listPilotEvaluationAdapterModeOptions(input: {
  events: PilotTelemetryEventRecord[];
  snapshots: PilotTelemetryRollupSnapshot[];
}): string[] {
  return listDistinctValues([
    ...input.snapshots.flatMap((snapshot) =>
      snapshot.segments.map((segment) => segment.adapterMode),
    ),
    ...input.events.map((event) =>
      typeof event.properties.pilot_adapter_mode === "string"
        ? event.properties.pilot_adapter_mode
        : undefined,
    ),
  ]);
}

export function buildPilotEvaluationDashboard(input: {
  events: PilotTelemetryEventRecord[];
  filters?: PilotEvaluationDashboardFilters;
  snapshots: PilotTelemetryRollupSnapshot[];
}): PilotEvaluationDashboardModel {
  const filters = input.filters ?? {};
  const snapshots = sortSnapshots(input.snapshots);
  const latestSnapshot = snapshots.at(-1);

  return {
    adapterOptions: listPilotEvaluationAdapterModeOptions(input),
    categoryViews: CATEGORY_ORDER.map((category) => ({
      category,
      description: CATEGORY_METADATA[category].description,
      metrics: listMetricDefinitionsByCategory(category).map((definition) =>
        buildMetricView(definition, snapshots, input.events, filters),
      ),
      title: CATEGORY_METADATA[category].title,
    })),
    checkpointRows: [...snapshots]
      .slice(-CHECKPOINT_ROW_LIMIT)
      .reverse()
      .map((snapshot) => buildCheckpointRow(snapshot, input.events, filters)),
    currentSummary: buildSummaryForSnapshot(input.events, filters, latestSnapshot),
    latestSegments: listPilotTelemetryRollupSegments(
      latestSnapshot,
      buildRollupFilters(filters),
    ),
    latestSnapshot,
    partnerOptions: listPilotEvaluationPartnerOptions(input),
    snapshotCount: snapshots.length,
  };
}
