import { afterEach, describe, expect, it } from "vitest";
import { captureAdmissionsDecision } from "./admissionsDecisioning";
import { createSeedAdmissionsRecords } from "./admissionsWorkspace";
import {
  buildAdmissionsPilotTelemetrySummary,
  buildAdmissionsDecisionTelemetryProperties,
  captureAdmissionsPilotTelemetryEvent,
  clearPilotTelemetryEvents,
  createAdmissionsPilotTelemetryProperties,
  createRolloutModePilotTelemetryProperties,
  getPilotMetricDefinition,
  loadPilotTelemetryEvents,
  listPilotMetricDefinitions,
  savePilotTelemetryEvents,
  validatePilotTelemetryBatch,
  validatePilotTelemetryEvent,
} from "./pilotTelemetry";
import { createSeedPartnerCourseRolloutConfigs } from "./partnerCourseRollout";

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

describe("pilotTelemetry", () => {
  afterEach(() => {
    if (originalWindow) {
      globalThis.window = originalWindow;
    } else {
      // @ts-expect-error clearing test window shim
      delete globalThis.window;
    }
  });

  it("exposes queryable metric definitions by category", () => {
    const feasibilityMetrics = listPilotMetricDefinitions("feasibility");

    expect(
      feasibilityMetrics.map((metric) => metric.key),
    ).toContain("provisioning_success_rate_by_adapter");
    expect(getPilotMetricDefinition("decision_cycle_time_hours")).toMatchObject({
      category: "viability",
      unit: "hours",
    });
  });

  it("builds a valid admissions decision telemetry payload with shared dimensions", async () => {
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

    const properties = createAdmissionsPilotTelemetryProperties(
      "admissions_decision_captured",
      {
        actor: "samira.chen@keypath.com.au",
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
      },
    );

    expect(properties).toMatchObject({
      pilot_adapter_mode: "file",
      pilot_application_id: "app-scu-004",
      pilot_course_code: "MBA-ONLINE",
      pilot_partner_id: "SCU",
      pilot_provisioning_status: "completed",
      pilot_reconciliation_status: "matched",
      pilot_rollout_mode: "mode-3-automated-provisioning",
      pilot_time_to_decision_source: "assignment",
    });
    expect(properties.pilot_time_to_decision_hours).toEqual(expect.any(Number));
    expect(validatePilotTelemetryEvent("admissions_decision_captured", properties)).toEqual(
      [],
    );
  });

  it("builds a valid rollout transition telemetry payload", () => {
    const config = createSeedPartnerCourseRolloutConfigs().find(
      (candidate) => candidate.partnerId === "TIU" && candidate.courseCode === "GC-PM",
    );

    expect(config).toBeDefined();

    const properties = createRolloutModePilotTelemetryProperties({
      actor: "ops.lead@keypath.com.au",
      config: config!,
      nextMode: "mode-3-automated-provisioning",
      outcome: "applied",
      previousMode: config!.activeMode,
      reason: "Promote TIU pilot to automated provisioning.",
    });

    expect(properties).toMatchObject({
      pilot_course_code: "GC-PM",
      pilot_partner_id: "TIU",
      pilot_previous_rollout_mode: "mode-2-decision-export",
      pilot_rollout_mode: "mode-3-automated-provisioning",
      pilot_rollout_update_outcome: "applied",
    });
    expect(
      validatePilotTelemetryEvent("admissions_rollout_mode_updated", properties),
    ).toEqual([]);
  });

  it("attributes mode 2 export decisions to the file adapter", async () => {
    const result = await captureAdmissionsDecision(createSeedAdmissionsRecords(), {
      actor: "samira.chen@keypath.com.au",
      applicationId: "app-tiu-008",
      outcome: "admit",
      reasonCode: "competitive-profile",
    });
    const updatedRecord = result.records.find(
      (record) => record.applicationId === "app-tiu-008",
    );

    expect(updatedRecord).toBeDefined();

    const properties = buildAdmissionsDecisionTelemetryProperties({
      decisionOutcome: "admit",
      downstreamAction: result.downstreamAction,
      provisioningTriggered: result.triggeredProvisioning,
      reasonCode: "competitive-profile",
      record: updatedRecord!,
      rolloutMode: result.rolloutMode,
    });

    expect(properties.pilot_adapter_mode).toBe("file");
    expect(properties.pilot_downstream_action).toBe("export");
  });

  it("detects missing and malformed telemetry properties", () => {
    const issues = validatePilotTelemetryBatch([
      {
        eventName: "admissions_status_updated",
        properties: {
          pilot_actor_id_hash: "fnv1a:test",
          pilot_application_id: "",
          pilot_assignment_state: "assigned",
          pilot_course_code: "MBA-GEN",
          pilot_course_line_key: "SCU:MBA-GEN",
          pilot_course_title: "Master of Business Administration",
          pilot_exception_state: "none",
          pilot_metric_categories: "viability",
          pilot_note_count: 0,
          pilot_partner_id: "SCU",
          pilot_partner_name: "Southern Coast University",
          pilot_previous_queue_status: "assigned",
          pilot_priority: "high",
          pilot_provisioning_status: "not-triggered",
          pilot_queue_status: "assigned",
          pilot_reconciliation_status: "not-run",
          pilot_rollout_mode: "mode-4-invalid",
          pilot_schema_version: "v1",
          pilot_status_target: "under-review",
          pilot_surface: "admissions-workspace",
        },
      },
    ]);

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: "pilot_application_id",
        }),
        expect.objectContaining({
          property: "pilot_rollout_mode",
        }),
      ]),
    );
  });

  it("persists admissions telemetry events and summarizes cohort metrics", async () => {
    installLocalStorageMock();
    clearPilotTelemetryEvents();

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

    captureAdmissionsPilotTelemetryEvent("admissions_queue_review_opened", {
      actor: "samira.chen@keypath.com.au",
      occurredAt: "2026-03-11T09:00:00Z",
      record: updatedRecord!,
      rolloutMode: result.rolloutMode,
    });
    captureAdmissionsPilotTelemetryEvent("admissions_document_preview_opened", {
      actor: "samira.chen@keypath.com.au",
      occurredAt: "2026-03-11T09:05:00Z",
      properties: {
        pilot_document_access_outcome: "opened",
        pilot_document_category: "transcript",
        pilot_document_id: "doc-scu-transcript",
      },
      record: updatedRecord!,
      rolloutMode: result.rolloutMode,
    });
    captureAdmissionsPilotTelemetryEvent("admissions_note_added", {
      actor: "reviewer.two@keypath.com.au",
      occurredAt: "2026-03-11T09:10:00Z",
      record: {
        ...updatedRecord!,
        notes: [
          ...updatedRecord!.notes,
          {
            author: "reviewer.two@keypath.com.au",
            body: "Escalation note",
            createdAt: "2026-03-11T09:10:00Z",
            noteId: "note-telemetry",
          },
        ],
      },
      rolloutMode: result.rolloutMode,
    });
    captureAdmissionsPilotTelemetryEvent("admissions_decision_captured", {
      actor: "samira.chen@keypath.com.au",
      occurredAt: "2026-03-11T09:15:00Z",
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

    const persistedEvents = loadPilotTelemetryEvents();
    const summary = buildAdmissionsPilotTelemetrySummary(persistedEvents, {
      courseCode: "MBA-ONLINE",
      partnerId: "SCU",
    });

    expect(persistedEvents).toHaveLength(4);
    expect(summary).toMatchObject({
      decisionCount: 1,
      totalEvents: 4,
      weeklyActiveReviewers: 2,
    });
    expect(summary.averageTimeToDecisionHours).toEqual(expect.any(Number));
    expect(summary.medianTimeToDecisionHours).toEqual(expect.any(Number));
    expect(summary.coverage.passed).toBe(true);
  });

  it("stores and reloads telemetry records from local storage", () => {
    installLocalStorageMock();

    savePilotTelemetryEvents([
      {
        eventId: "pilot-telemetry:test",
        eventName: "admissions_queue_review_opened",
        occurredAt: "2026-03-11T10:00:00Z",
        properties: {
          pilot_actor_id_hash: "fnv1a:test",
          pilot_application_id: "app-scu-004",
          pilot_assignment_state: "assigned",
          pilot_course_code: "MBA-ONLINE",
          pilot_course_line_key: "SCU:MBA-ONLINE",
          pilot_course_title: "Master of Business Administration",
          pilot_exception_state: "none",
          pilot_metric_categories: "desirability",
          pilot_note_count: 0,
          pilot_partner_id: "SCU",
          pilot_partner_name: "Southern Coast University",
          pilot_priority: "high",
          pilot_provisioning_status: "not-triggered",
          pilot_queue_status: "under-review",
          pilot_reconciliation_status: "not-run",
          pilot_rollout_mode: "mode-3-automated-provisioning",
          pilot_schema_version: "v1",
          pilot_surface: "admissions-workspace",
        },
      },
    ]);

    expect(loadPilotTelemetryEvents()).toMatchObject([
      {
        eventId: "pilot-telemetry:test",
        eventName: "admissions_queue_review_opened",
      },
    ]);
  });
});
