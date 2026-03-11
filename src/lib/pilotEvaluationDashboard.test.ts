import { afterEach, describe, expect, it } from "vitest";
import { captureAdmissionsDecision } from "./admissionsDecisioning";
import {
  assignAdmissionsRecord,
  createSeedAdmissionsRecords,
  updateAdmissionsStatus,
} from "./admissionsWorkspace";
import { buildPilotEvaluationDashboard } from "./pilotEvaluationDashboard";
import {
  buildAdmissionsDecisionTelemetryProperties,
  captureAdmissionsPilotTelemetryEvent,
  clearPilotTelemetryEvents,
  loadPilotTelemetryEvents,
  PILOT_TELEMETRY_STORAGE_KEY,
} from "./pilotTelemetry";
import {
  loadPilotTelemetryRollups,
  PILOT_TELEMETRY_ROLLUP_STORAGE_KEY,
} from "./pilotTelemetryRollups";
import {
  createSeedPartnerCourseRolloutConfigs,
  transitionPartnerCourseRolloutMode,
} from "./partnerCourseRollout";

const originalWindow = globalThis.window;

function installLocalStorageMock() {
  const storage = new Map<string, string>();

  globalThis.window = {
    localStorage: {
      getItem(key: string) {
        return storage.has(key) ? storage.get(key)! : null;
      },
      removeItem(key: string) {
        storage.delete(key);
      },
      setItem(key: string, value: string) {
        storage.set(key, value);
      },
    },
  } as typeof window;
}

async function seedDashboardTelemetry() {
  installLocalStorageMock();
  clearPilotTelemetryEvents();
  window.localStorage.removeItem(PILOT_TELEMETRY_STORAGE_KEY);
  window.localStorage.removeItem(PILOT_TELEMETRY_ROLLUP_STORAGE_KEY);

  const baseRecords = createSeedAdmissionsRecords();
  const scuResult = await captureAdmissionsDecision(baseRecords, {
    actor: "samira.chen@keypath.com.au",
    applicationId: "app-scu-004",
    outcome: "admit",
    reasonCode: "academic-qualified",
  });
  const tiuResult = await captureAdmissionsDecision(baseRecords, {
    actor: "samira.chen@keypath.com.au",
    applicationId: "app-tiu-008",
    outcome: "admit",
    reasonCode: "competitive-profile",
  });
  const hhiReadyRecords = updateAdmissionsStatus(
    assignAdmissionsRecord(createSeedAdmissionsRecords(), {
      actor: "alex.wong@keypath.com.au",
      applicationId: "app-hhi-003",
      assignee: "alex.wong@keypath.com.au",
      occurredAt: "2026-03-10T12:20:00Z",
    }),
    {
      actor: "alex.wong@keypath.com.au",
      applicationId: "app-hhi-003",
      occurredAt: "2026-03-10T12:21:00Z",
      status: "ready-for-decision",
    },
  );
  const hhiRollout = transitionPartnerCourseRolloutMode(
    createSeedPartnerCourseRolloutConfigs(),
    {
      actor: "ops.lead@keypath.com.au",
      courseCode: "BN-HEALTH",
      courseTitle: "Bachelor of Nursing",
      nextMode: "mode-3-automated-provisioning",
      occurredAt: "2026-03-10T12:18:00Z",
      partnerId: "HHI",
      partnerName: "Harbour Health Institute",
      reason: "Promote HHI nursing to automated provisioning.",
    },
  );
  const hhiResult = await captureAdmissionsDecision(hhiReadyRecords, {
    actor: "alex.wong@keypath.com.au",
    applicationId: "app-hhi-003",
    outcome: "admit",
    reasonCode: "competitive-profile",
    rolloutConfigs: hhiRollout.configs,
  });

  const scuRecord = scuResult.records.find(
    (record) => record.applicationId === "app-scu-004",
  );
  const tiuRecord = tiuResult.records.find(
    (record) => record.applicationId === "app-tiu-008",
  );
  const hhiRecord = hhiResult.records.find(
    (record) => record.applicationId === "app-hhi-003",
  );

  expect(scuRecord && tiuRecord && hhiRecord).toBeTruthy();

  captureAdmissionsPilotTelemetryEvent("admissions_decision_captured", {
    actor: "samira.chen@keypath.com.au",
    occurredAt: "2026-03-11T09:05:00Z",
    properties: buildAdmissionsDecisionTelemetryProperties({
      decisionOutcome: "admit",
      downstreamAction: scuResult.downstreamAction,
      provisioningTriggered: scuResult.triggeredProvisioning,
      reasonCode: "academic-qualified",
      record: scuRecord!,
      rolloutMode: scuResult.rolloutMode,
    }),
    record: scuRecord!,
    rolloutMode: scuResult.rolloutMode,
  });
  captureAdmissionsPilotTelemetryEvent("admissions_document_preview_opened", {
    actor: "samira.chen@keypath.com.au",
    occurredAt: "2026-03-11T09:15:00Z",
    properties: {
      pilot_document_access_outcome: "opened",
      pilot_document_category: "transcript",
      pilot_document_id: "doc-scu-transcript",
    },
    record: scuRecord!,
    rolloutMode: scuResult.rolloutMode,
  });
  captureAdmissionsPilotTelemetryEvent("admissions_decision_captured", {
    actor: "samira.chen@keypath.com.au",
    occurredAt: "2026-03-11T09:25:00Z",
    properties: buildAdmissionsDecisionTelemetryProperties({
      decisionOutcome: "admit",
      downstreamAction: tiuResult.downstreamAction,
      provisioningTriggered: tiuResult.triggeredProvisioning,
      reasonCode: "competitive-profile",
      record: tiuRecord!,
      rolloutMode: tiuResult.rolloutMode,
    }),
    record: tiuRecord!,
    rolloutMode: tiuResult.rolloutMode,
  });
  captureAdmissionsPilotTelemetryEvent("admissions_queue_review_opened", {
    actor: "alex.wong@keypath.com.au",
    occurredAt: "2026-03-11T10:05:00Z",
    record: hhiRecord!,
    rolloutMode: hhiResult.rolloutMode,
  });
  captureAdmissionsPilotTelemetryEvent("admissions_decision_captured", {
    actor: "alex.wong@keypath.com.au",
    occurredAt: "2026-03-11T10:20:00Z",
    properties: buildAdmissionsDecisionTelemetryProperties({
      decisionOutcome: "admit",
      downstreamAction: hhiResult.downstreamAction,
      provisioningTriggered: hhiResult.triggeredProvisioning,
      reasonCode: "competitive-profile",
      record: hhiRecord!,
      rolloutMode: hhiResult.rolloutMode,
    }),
    record: hhiRecord!,
    rolloutMode: hhiResult.rolloutMode,
  });

  return {
    events: loadPilotTelemetryEvents(),
    snapshots: loadPilotTelemetryRollups(),
  };
}

describe("pilotEvaluationDashboard", () => {
  afterEach(() => {
    if (originalWindow) {
      globalThis.window = originalWindow;
    } else {
      // @ts-expect-error clearing test window shim
      delete globalThis.window;
    }
  });

  it("builds category views, filters, and checkpoint rows from stored rollups", async () => {
    const { events, snapshots } = await seedDashboardTelemetry();
    const dashboard = buildPilotEvaluationDashboard({
      events,
      snapshots,
    });

    expect(dashboard.snapshotCount).toBe(2);
    expect(dashboard.checkpointRows).toHaveLength(2);
    expect(dashboard.partnerOptions).toEqual(
      expect.arrayContaining([
        "Harbour Health Institute",
        "Southern Coast University",
        "Tasman Institute of Technology",
      ]),
    );
    expect(dashboard.adapterOptions).toEqual(
      expect.arrayContaining(["file", "portal-rpa"]),
    );
    expect(dashboard.categoryViews.map((view) => view.category)).toEqual([
      "viability",
      "feasibility",
      "desirability",
    ]);
  });

  it("filters the dashboard by university and adapter path", async () => {
    const { events, snapshots } = await seedDashboardTelemetry();
    const dashboard = buildPilotEvaluationDashboard({
      events,
      filters: {
        adapterMode: "portal-rpa",
        partnerName: "Harbour Health Institute",
      },
      snapshots,
    });
    const provisioningMetric = dashboard.categoryViews
      .find((view) => view.category === "feasibility")
      ?.metrics.find(
        (metric) =>
          metric.definition.key === "provisioning_success_rate_by_adapter",
      );

    expect(dashboard.latestSegments).toHaveLength(1);
    expect(dashboard.currentSummary.decisionCount).toBe(1);
    expect(provisioningMetric?.currentValue).toBe(1);
  });

  it("uses raw telemetry for weekly active reviewers so shared actors are not double-counted across segments", async () => {
    const { events, snapshots } = await seedDashboardTelemetry();
    const dashboard = buildPilotEvaluationDashboard({
      events,
      filters: {
        adapterMode: "file",
      },
      snapshots,
    });
    const desirabilityMetric = dashboard.categoryViews
      .find((view) => view.category === "desirability")
      ?.metrics.find(
        (metric) => metric.definition.key === "weekly_active_reviewers",
      );

    expect(dashboard.latestSegments).toHaveLength(2);
    expect(desirabilityMetric?.currentValue).toBe(1);
    expect(desirabilityMetric?.detail).toContain("1 unique reviewer");
  });
});
