import { afterEach, describe, expect, it } from "vitest";
import { captureAdmissionsDecision } from "./admissionsDecisioning";
import {
  assignAdmissionsRecord,
  createSeedAdmissionsRecords,
  updateAdmissionsStatus,
} from "./admissionsWorkspace";
import {
  buildAdmissionsDecisionTelemetryProperties,
  captureAdmissionsPilotTelemetryEvent,
  clearPilotTelemetryEvents,
  loadPilotTelemetryEvents,
} from "./pilotTelemetry";
import {
  loadLatestPilotTelemetryRollup,
  PILOT_TELEMETRY_ROLLUP_STORAGE_KEY,
  syncScheduledPilotTelemetryRollups,
  validatePilotTelemetryRollupSnapshot,
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

describe("pilotTelemetryRollups", () => {
  afterEach(() => {
    if (originalWindow) {
      globalThis.window = originalWindow;
    } else {
      // @ts-expect-error clearing test window shim
      delete globalThis.window;
    }
  });

  it("syncs hourly KPI rollups automatically from stored telemetry events", async () => {
    installLocalStorageMock();
    clearPilotTelemetryEvents();
    window.localStorage.removeItem(PILOT_TELEMETRY_ROLLUP_STORAGE_KEY);

    const scuResult = await captureAdmissionsDecision(createSeedAdmissionsRecords(), {
      actor: "samira.chen@keypath.com.au",
      applicationId: "app-scu-004",
      outcome: "admit",
      reasonCode: "academic-qualified",
    });
    const scuRecord = scuResult.records.find(
      (record) => record.applicationId === "app-scu-004",
    );

    expect(scuRecord).toBeDefined();

    captureAdmissionsPilotTelemetryEvent("admissions_decision_captured", {
      actor: "samira.chen@keypath.com.au",
      occurredAt: "2026-03-11T09:15:00Z",
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

    const latestSnapshot = loadLatestPilotTelemetryRollup();

    expect(latestSnapshot).toBeDefined();
    expect(latestSnapshot).toMatchObject({
      schedule: "hourly",
      sourceEventCount: 1,
    });
    expect(latestSnapshot?.consistency.passed).toBe(true);
  });

  it("segments rollups by university, course line, and adapter mode", async () => {
    installLocalStorageMock();
    clearPilotTelemetryEvents();
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
        reason: "Promote HHI nursing to automated portal fallback for the experiment.",
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
      occurredAt: "2026-03-11T09:00:00Z",
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
    captureAdmissionsPilotTelemetryEvent("admissions_decision_captured", {
      actor: "samira.chen@keypath.com.au",
      occurredAt: "2026-03-11T09:05:00Z",
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
    captureAdmissionsPilotTelemetryEvent("admissions_decision_captured", {
      actor: "alex.wong@keypath.com.au",
      occurredAt: "2026-03-11T09:10:00Z",
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

    const snapshot = syncScheduledPilotTelemetryRollups({
      events: loadPilotTelemetryEvents(),
      now: "2026-03-11T09:20:00Z",
    });

    expect(snapshot.consistency.passed).toBe(true);
    expect(
      snapshot.segments.map((segment) => ({
        adapterMode: segment.adapterMode,
        partnerId: segment.partnerId,
      })),
    ).toEqual(
      expect.arrayContaining([
        { adapterMode: "file", partnerId: "SCU" },
        { adapterMode: "file", partnerId: "TIU" },
        { adapterMode: "portal-rpa", partnerId: "HHI" },
      ]),
    );
  });

  it("flags consistency failures when stored rollups drift from source telemetry", async () => {
    installLocalStorageMock();
    clearPilotTelemetryEvents();
    window.localStorage.removeItem(PILOT_TELEMETRY_ROLLUP_STORAGE_KEY);

    const result = await captureAdmissionsDecision(createSeedAdmissionsRecords(), {
      actor: "samira.chen@keypath.com.au",
      applicationId: "app-scu-004",
      outcome: "admit",
      reasonCode: "academic-qualified",
    });
    const updatedRecord = result.records.find(
      (record) => record.applicationId === "app-scu-004",
    );

    expect(updatedRecord).toBeDefined();

    captureAdmissionsPilotTelemetryEvent("admissions_decision_captured", {
      actor: "samira.chen@keypath.com.au",
      occurredAt: "2026-03-11T09:00:00Z",
      properties: buildAdmissionsDecisionTelemetryProperties({
        decisionOutcome: "admit",
        downstreamAction: result.downstreamAction,
        provisioningTriggered: result.triggeredProvisioning,
        reasonCode: "academic-qualified",
        record: updatedRecord!,
        rolloutMode: result.rolloutMode,
      }),
      record: updatedRecord!,
      rolloutMode: result.rolloutMode,
    });

    const sourceEvents = loadPilotTelemetryEvents();
    const snapshot = syncScheduledPilotTelemetryRollups({
      events: sourceEvents,
      now: "2026-03-11T09:15:00Z",
    });
    const tamperedSnapshot = {
      ...snapshot,
      segments: snapshot.segments.map((segment, index) =>
        index === 0
          ? {
              ...segment,
              metrics: segment.metrics.map((metric) =>
                metric.key === "approved_decision_handoff_rate"
                  ? { ...metric, value: 0 }
                  : metric,
              ),
            }
          : segment,
      ),
    };
    const consistency = validatePilotTelemetryRollupSnapshot(
      tamperedSnapshot,
      sourceEvents,
    );

    expect(consistency.passed).toBe(false);
    expect(consistency.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "metric-consistency",
          metricKey: "approved_decision_handoff_rate",
          passed: false,
        }),
      ]),
    );
  });
});
