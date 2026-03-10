import type {
  PilotMetricKey,
  PilotTelemetryEventRecord,
} from "./pilotTelemetry";

export const PILOT_TELEMETRY_ROLLUP_SCHEMA_VERSION = "v1";
export const PILOT_TELEMETRY_ROLLUP_STORAGE_KEY =
  "application-prototype:pilot-telemetry-rollups:v1";
export const PILOT_TELEMETRY_ROLLUP_INTERVAL_MINUTES = 60;

const MAX_ROLLUP_HISTORY = 24;
const NOT_APPLICABLE_ADAPTER_MODE = "not-applicable";
const APPROVED_DECISION_OUTCOMES = new Set(["admit", "conditional"]);
const REVIEWER_EVENT_NAMES = new Set([
  "admissions_queue_review_opened",
  "admissions_decision_captured",
  "admissions_document_preview_opened",
  "admissions_note_added",
]);
const DOCUMENT_EVENT_NAMES = new Set([
  "admissions_document_preview_opened",
  "admissions_document_preview_blocked",
]);

const ROLLUP_METRIC_UNITS: Record<PilotMetricKey, "hours" | "rate" | "reviewers"> = {
  decision_cycle_time_hours: "hours",
  approved_decision_handoff_rate: "rate",
  provisioning_success_rate_by_adapter: "rate",
  reconciliation_match_rate: "rate",
  weekly_active_reviewers: "reviewers",
  secure_document_view_success_rate: "rate",
};

export interface PilotTelemetryRollupMetricValue {
  denominator?: number;
  key: PilotMetricKey;
  numerator?: number;
  sampleSize?: number;
  unit: "hours" | "rate" | "reviewers";
  value: number | null;
}

export interface PilotTelemetryRollupSegment {
  adapterMode: string;
  courseCode: string;
  courseLineKey: string;
  courseTitle: string;
  decisionCount: number;
  eventCount: number;
  metrics: PilotTelemetryRollupMetricValue[];
  partnerId: string;
  partnerName: string;
  segmentId: string;
}

export interface PilotTelemetryRollupConsistencyCheck {
  detail: string;
  key: "extra-segment" | "metric-consistency" | "missing-segment" | "source-event-count";
  metricKey?: PilotMetricKey;
  passed: boolean;
  segmentId?: string;
}

export interface PilotTelemetryRollupConsistencyReport {
  checks: PilotTelemetryRollupConsistencyCheck[];
  issueCount: number;
  passed: boolean;
}

export interface PilotTelemetryRollupSnapshot {
  consistency: PilotTelemetryRollupConsistencyReport;
  generatedAt: string;
  nextScheduledAt: string;
  schedule: "hourly";
  scheduleWindowStart: string;
  schemaVersion: string;
  segments: PilotTelemetryRollupSegment[];
  snapshotId: string;
  sourceEventCount: number;
  sourceFingerprint: string;
  sourceWindowEnd?: string;
  sourceWindowStart?: string;
}

export interface PilotTelemetryRollupFilter {
  adapterMode?: string;
  courseCode?: string;
  courseLineKey?: string;
  partnerId?: string;
  partnerName?: string;
}

function readString(
  event: PilotTelemetryEventRecord,
  property: string,
): string | undefined {
  const value = event.properties[property];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function readNumber(
  event: PilotTelemetryEventRecord,
  property: string,
): number | undefined {
  const value = event.properties[property];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readBoolean(
  event: PilotTelemetryEventRecord,
  property: string,
): boolean | undefined {
  const value = event.properties[property];
  return typeof value === "boolean" ? value : undefined;
}

function sortEvents(events: PilotTelemetryEventRecord[]): PilotTelemetryEventRecord[] {
  return [...events].sort((left, right) => {
    const occurredAtComparison = left.occurredAt.localeCompare(right.occurredAt);
    if (occurredAtComparison !== 0) {
      return occurredAtComparison;
    }

    return left.eventId.localeCompare(right.eventId);
  });
}

function calculateAverage(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return Number(
    (values.reduce((total, value) => total + value, 0) / values.length).toFixed(2),
  );
}

function calculateRate(numerator: number, denominator: number): number | null {
  if (denominator === 0) {
    return null;
  }

  return Number((numerator / denominator).toFixed(4));
}

function normalizeAdapterMode(value: string | undefined): string {
  return value?.trim().length ? value : NOT_APPLICABLE_ADAPTER_MODE;
}

function truncateToHour(value: string): string {
  const date = new Date(value);
  date.setMinutes(0, 0, 0);
  return date.toISOString();
}

function addHours(value: string, hours: number): string {
  const date = new Date(value);
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

function buildSourceFingerprint(events: PilotTelemetryEventRecord[]): string {
  return sortEvents(events)
    .map((event) => event.eventId)
    .join("|");
}

function cloneMetricValue(
  metric: PilotTelemetryRollupMetricValue,
): PilotTelemetryRollupMetricValue {
  return {
    ...metric,
  };
}

function cloneSegment(segment: PilotTelemetryRollupSegment): PilotTelemetryRollupSegment {
  return {
    ...segment,
    metrics: segment.metrics.map((metric) => cloneMetricValue(metric)),
  };
}

function cloneConsistencyCheck(
  check: PilotTelemetryRollupConsistencyCheck,
): PilotTelemetryRollupConsistencyCheck {
  return {
    ...check,
  };
}

function cloneConsistencyReport(
  report: PilotTelemetryRollupConsistencyReport,
): PilotTelemetryRollupConsistencyReport {
  return {
    ...report,
    checks: report.checks.map((check) => cloneConsistencyCheck(check)),
  };
}

function cloneSnapshot(
  snapshot: PilotTelemetryRollupSnapshot,
): PilotTelemetryRollupSnapshot {
  return {
    ...snapshot,
    consistency: cloneConsistencyReport(snapshot.consistency),
    segments: snapshot.segments.map((segment) => cloneSegment(segment)),
  };
}

function buildSegmentMetrics(
  events: PilotTelemetryEventRecord[],
  referenceTimestamp: string,
): PilotTelemetryRollupMetricValue[] {
  const decisionEvents = events.filter(
    (event) => event.eventName === "admissions_decision_captured",
  );
  const approvedDecisionEvents = decisionEvents.filter((event) =>
    APPROVED_DECISION_OUTCOMES.has(
      readString(event, "pilot_decision_outcome") ?? "",
    ),
  );
  const decisionCycleValues = decisionEvents
    .map((event) => readNumber(event, "pilot_time_to_decision_hours"))
    .filter((value): value is number => value !== undefined);
  const approvedHandoffNumerator = approvedDecisionEvents.filter(
    (event) => readString(event, "pilot_downstream_action") !== "none",
  ).length;
  const provisioningCandidates = decisionEvents.filter(
    (event) => readBoolean(event, "pilot_provisioning_triggered") === true,
  );
  const provisioningSuccessNumerator = provisioningCandidates.filter(
    (event) => readString(event, "pilot_provisioning_status") === "completed",
  ).length;
  const reconciliationMatchNumerator = provisioningCandidates.filter(
    (event) => readString(event, "pilot_reconciliation_status") === "matched",
  ).length;
  const documentEvents = events.filter((event) =>
    DOCUMENT_EVENT_NAMES.has(event.eventName),
  );
  const documentSuccessNumerator = documentEvents.filter(
    (event) => event.eventName === "admissions_document_preview_opened",
  ).length;
  const weeklyWindowStart = new Date(referenceTimestamp);
  weeklyWindowStart.setDate(weeklyWindowStart.getDate() - 7);
  const weeklyActiveReviewers = new Set(
    events
      .filter((event) => REVIEWER_EVENT_NAMES.has(event.eventName))
      .filter((event) => {
        const occurredAt = Date.parse(event.occurredAt);
        return (
          Number.isFinite(occurredAt) &&
          occurredAt >= Date.parse(weeklyWindowStart.toISOString()) &&
          occurredAt <= Date.parse(referenceTimestamp)
        );
      })
      .map((event) => readString(event, "pilot_actor_id_hash"))
      .filter((value): value is string => Boolean(value)),
  ).size;

  return [
    {
      key: "decision_cycle_time_hours",
      sampleSize: decisionCycleValues.length,
      unit: ROLLUP_METRIC_UNITS.decision_cycle_time_hours,
      value: calculateAverage(decisionCycleValues),
    },
    {
      denominator: approvedDecisionEvents.length,
      key: "approved_decision_handoff_rate",
      numerator: approvedHandoffNumerator,
      sampleSize: approvedDecisionEvents.length,
      unit: ROLLUP_METRIC_UNITS.approved_decision_handoff_rate,
      value: calculateRate(
        approvedHandoffNumerator,
        approvedDecisionEvents.length,
      ),
    },
    {
      denominator: provisioningCandidates.length,
      key: "provisioning_success_rate_by_adapter",
      numerator: provisioningSuccessNumerator,
      sampleSize: provisioningCandidates.length,
      unit: ROLLUP_METRIC_UNITS.provisioning_success_rate_by_adapter,
      value: calculateRate(
        provisioningSuccessNumerator,
        provisioningCandidates.length,
      ),
    },
    {
      denominator: provisioningCandidates.length,
      key: "reconciliation_match_rate",
      numerator: reconciliationMatchNumerator,
      sampleSize: provisioningCandidates.length,
      unit: ROLLUP_METRIC_UNITS.reconciliation_match_rate,
      value: calculateRate(
        reconciliationMatchNumerator,
        provisioningCandidates.length,
      ),
    },
    {
      key: "weekly_active_reviewers",
      sampleSize: weeklyActiveReviewers,
      unit: ROLLUP_METRIC_UNITS.weekly_active_reviewers,
      value: weeklyActiveReviewers,
    },
    {
      denominator: documentEvents.length,
      key: "secure_document_view_success_rate",
      numerator: documentSuccessNumerator,
      sampleSize: documentEvents.length,
      unit: ROLLUP_METRIC_UNITS.secure_document_view_success_rate,
      value: calculateRate(documentSuccessNumerator, documentEvents.length),
    },
  ];
}

function buildRollupSegments(
  events: PilotTelemetryEventRecord[],
  referenceTimestamp: string,
): PilotTelemetryRollupSegment[] {
  const grouped = new Map<string, PilotTelemetryEventRecord[]>();

  sortEvents(events).forEach((event) => {
    const partnerId = readString(event, "pilot_partner_id");
    const partnerName = readString(event, "pilot_partner_name");
    const courseCode = readString(event, "pilot_course_code");
    const courseLineKey = readString(event, "pilot_course_line_key");
    const courseTitle = readString(event, "pilot_course_title");

    if (!partnerId || !partnerName || !courseCode || !courseLineKey || !courseTitle) {
      return;
    }

    const adapterMode = normalizeAdapterMode(
      readString(event, "pilot_adapter_mode"),
    );
    const segmentId = [partnerId, courseLineKey, adapterMode].join(":");
    const current = grouped.get(segmentId) ?? [];
    current.push(event);
    grouped.set(segmentId, current);
  });

  return Array.from(grouped.entries())
    .map(([segmentId, segmentEvents]) => {
      const first = segmentEvents[0];

      return {
        adapterMode: normalizeAdapterMode(
          readString(first, "pilot_adapter_mode"),
        ),
        courseCode: readString(first, "pilot_course_code") ?? "",
        courseLineKey: readString(first, "pilot_course_line_key") ?? "",
        courseTitle: readString(first, "pilot_course_title") ?? "",
        decisionCount: segmentEvents.filter(
          (event) => event.eventName === "admissions_decision_captured",
        ).length,
        eventCount: segmentEvents.length,
        metrics: buildSegmentMetrics(segmentEvents, referenceTimestamp),
        partnerId: readString(first, "pilot_partner_id") ?? "",
        partnerName: readString(first, "pilot_partner_name") ?? "",
        segmentId,
      };
    })
    .sort((left, right) =>
      `${left.partnerName}:${left.courseTitle}:${left.adapterMode}`.localeCompare(
        `${right.partnerName}:${right.courseTitle}:${right.adapterMode}`,
      ),
    );
}

function metricMap(
  metrics: PilotTelemetryRollupMetricValue[],
): Map<PilotMetricKey, PilotTelemetryRollupMetricValue> {
  return new Map(metrics.map((metric) => [metric.key, metric]));
}

function metricsMatch(
  left: PilotTelemetryRollupMetricValue,
  right: PilotTelemetryRollupMetricValue,
): boolean {
  return (
    left.key === right.key &&
    left.value === right.value &&
    left.numerator === right.numerator &&
    left.denominator === right.denominator &&
    left.sampleSize === right.sampleSize
  );
}

export function validatePilotTelemetryRollupSnapshot(
  snapshot: PilotTelemetryRollupSnapshot,
  events: PilotTelemetryEventRecord[],
): PilotTelemetryRollupConsistencyReport {
  const expectedSegments = buildRollupSegments(
    events,
    snapshot.sourceWindowEnd ?? snapshot.generatedAt,
  );
  const expectedSegmentMap = new Map(
    expectedSegments.map((segment) => [segment.segmentId, segment]),
  );
  const actualSegmentMap = new Map(
    snapshot.segments.map((segment) => [segment.segmentId, segment]),
  );
  const checks: PilotTelemetryRollupConsistencyCheck[] = [
    {
      detail: `Rollup snapshot stores ${snapshot.sourceEventCount} source events and the source event log contains ${events.length}.`,
      key: "source-event-count",
      passed: snapshot.sourceEventCount === events.length,
    },
  ];

  expectedSegments.forEach((expectedSegment) => {
    const actualSegment = actualSegmentMap.get(expectedSegment.segmentId);

    if (!actualSegment) {
      checks.push({
        detail: `Missing rollup segment for ${expectedSegment.partnerName} ${expectedSegment.courseCode} on ${expectedSegment.adapterMode}.`,
        key: "missing-segment",
        passed: false,
        segmentId: expectedSegment.segmentId,
      });
      return;
    }

    const actualMetrics = metricMap(actualSegment.metrics);
    const expectedMetrics = metricMap(expectedSegment.metrics);

    expectedSegment.metrics.forEach((expectedMetric) => {
      const actualMetric = actualMetrics.get(expectedMetric.key);

      checks.push({
        detail: actualMetric
          ? `Rollup metric ${expectedMetric.key} matches source telemetry for segment ${expectedSegment.segmentId}.`
          : `Rollup metric ${expectedMetric.key} is missing for segment ${expectedSegment.segmentId}.`,
        key: "metric-consistency",
        metricKey: expectedMetric.key,
        passed: actualMetric ? metricsMatch(actualMetric, expectedMetric) : false,
        segmentId: expectedSegment.segmentId,
      });
    });

    if (actualSegment.eventCount !== expectedSegment.eventCount) {
      checks.push({
        detail: `Segment ${expectedSegment.segmentId} stores ${actualSegment.eventCount} events but source telemetry resolves to ${expectedSegment.eventCount}.`,
        key: "metric-consistency",
        passed: false,
        segmentId: expectedSegment.segmentId,
      });
    }
  });

  actualSegmentMap.forEach((actualSegment) => {
    if (!expectedSegmentMap.has(actualSegment.segmentId)) {
      checks.push({
        detail: `Rollup contains an extra segment ${actualSegment.segmentId} that is not present in source telemetry.`,
        key: "extra-segment",
        passed: false,
        segmentId: actualSegment.segmentId,
      });
    }
  });

  return {
    checks,
    issueCount: checks.filter((check) => !check.passed).length,
    passed: checks.every((check) => check.passed),
  };
}

export function buildPilotTelemetryRollupSnapshot(input: {
  events: PilotTelemetryEventRecord[];
  generatedAt?: string;
  scheduleWindowStart?: string;
}): PilotTelemetryRollupSnapshot {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const scheduleWindowStart = input.scheduleWindowStart ?? truncateToHour(generatedAt);
  const sortedEvents = sortEvents(input.events);
  const sourceWindowStart = sortedEvents[0]?.occurredAt;
  const sourceWindowEnd = sortedEvents.at(-1)?.occurredAt;
  const segments = buildRollupSegments(
    sortedEvents,
    sourceWindowEnd ?? generatedAt,
  );
  const snapshot: PilotTelemetryRollupSnapshot = {
    consistency: {
      checks: [],
      issueCount: 0,
      passed: true,
    },
    generatedAt,
    nextScheduledAt: addHours(scheduleWindowStart, 1),
    schedule: "hourly",
    scheduleWindowStart,
    schemaVersion: PILOT_TELEMETRY_ROLLUP_SCHEMA_VERSION,
    segments,
    snapshotId: `pilot-rollup:${scheduleWindowStart}`,
    sourceEventCount: sortedEvents.length,
    sourceFingerprint: buildSourceFingerprint(sortedEvents),
    sourceWindowEnd,
    sourceWindowStart,
  };

  return {
    ...snapshot,
    consistency: validatePilotTelemetryRollupSnapshot(snapshot, sortedEvents),
  };
}

export function loadPilotTelemetryRollups(): PilotTelemetryRollupSnapshot[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const storedValue = window.localStorage.getItem(
      PILOT_TELEMETRY_ROLLUP_STORAGE_KEY,
    );
    if (!storedValue) {
      return [];
    }

    const parsed = JSON.parse(storedValue) as PilotTelemetryRollupSnapshot[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((snapshot) => cloneSnapshot(snapshot));
  } catch {
    return [];
  }
}

export function savePilotTelemetryRollups(
  snapshots: PilotTelemetryRollupSnapshot[],
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      PILOT_TELEMETRY_ROLLUP_STORAGE_KEY,
      JSON.stringify(snapshots),
    );
  } catch {
    // Ignore storage failures and keep client-side rollups best-effort.
  }
}

export function loadLatestPilotTelemetryRollup():
  | PilotTelemetryRollupSnapshot
  | undefined {
  return loadPilotTelemetryRollups().at(-1);
}

export function listPilotTelemetryRollupSegments(
  snapshot: PilotTelemetryRollupSnapshot | undefined,
  filters: PilotTelemetryRollupFilter = {},
): PilotTelemetryRollupSegment[] {
  if (!snapshot) {
    return [];
  }

  return snapshot.segments
    .filter((segment) =>
      (filters.partnerId ? segment.partnerId === filters.partnerId : true) &&
      (filters.partnerName ? segment.partnerName === filters.partnerName : true) &&
      (filters.courseCode ? segment.courseCode === filters.courseCode : true) &&
      (filters.courseLineKey ? segment.courseLineKey === filters.courseLineKey : true) &&
      (filters.adapterMode ? segment.adapterMode === filters.adapterMode : true),
    )
    .map((segment) => cloneSegment(segment));
}

export function getPilotTelemetryRollupMetric(
  segment: PilotTelemetryRollupSegment,
  key: PilotMetricKey,
): PilotTelemetryRollupMetricValue | undefined {
  return segment.metrics.find((metric) => metric.key === key);
}

export function syncScheduledPilotTelemetryRollups(input: {
  events: PilotTelemetryEventRecord[];
  now?: string;
}): PilotTelemetryRollupSnapshot {
  const generatedAt = input.now ?? new Date().toISOString();
  const scheduleWindowStart = truncateToHour(generatedAt);
  const existingSnapshots = loadPilotTelemetryRollups();
  const latestSnapshot = existingSnapshots.at(-1);
  const sourceFingerprint = buildSourceFingerprint(input.events);

  if (
    latestSnapshot &&
    latestSnapshot.scheduleWindowStart === scheduleWindowStart &&
    latestSnapshot.sourceFingerprint === sourceFingerprint
  ) {
    return cloneSnapshot(latestSnapshot);
  }

  const nextSnapshot = buildPilotTelemetryRollupSnapshot({
    events: input.events,
    generatedAt,
    scheduleWindowStart,
  });
  const nextSnapshots = [
    ...existingSnapshots.filter(
      (snapshot) => snapshot.scheduleWindowStart !== scheduleWindowStart,
    ),
    nextSnapshot,
  ].slice(-MAX_ROLLUP_HISTORY);

  savePilotTelemetryRollups(nextSnapshots);
  return cloneSnapshot(nextSnapshot);
}
