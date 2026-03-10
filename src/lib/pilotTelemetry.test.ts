import { describe, expect, it } from "vitest";
import { captureAdmissionsDecision } from "./admissionsDecisioning";
import { createSeedAdmissionsRecords } from "./admissionsWorkspace";
import {
  buildAdmissionsDecisionTelemetryProperties,
  createAdmissionsPilotTelemetryProperties,
  createRolloutModePilotTelemetryProperties,
  getPilotMetricDefinition,
  listPilotMetricDefinitions,
  validatePilotTelemetryBatch,
  validatePilotTelemetryEvent,
} from "./pilotTelemetry";
import { createSeedPartnerCourseRolloutConfigs } from "./partnerCourseRollout";

describe("pilotTelemetry", () => {
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
});
