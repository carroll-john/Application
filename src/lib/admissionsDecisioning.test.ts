import { describe, expect, it } from "vitest";
import {
  assignAdmissionsRecord,
  createSeedAdmissionsRecords,
  updateAdmissionsStatus,
} from "./admissionsWorkspace";
import {
  captureAdmissionsDecision,
  evaluateAdmissionsDecisionReadiness,
  getLatestAdmissionsDecision,
  getLatestAdmissionsPortalRpaDriftSignal,
  getLatestAdmissionsPortalRpaRun,
  getLatestAdmissionsProvisioningJob,
  getLatestAdmissionsStructuredExport,
} from "./admissionsDecisioning";
import {
  createSeedPartnerCourseRolloutConfigs,
  transitionPartnerCourseRolloutMode,
} from "./partnerCourseRollout";

describe("admissionsDecisioning", () => {
  it("marks ready-for-decision records as decision-ready only when assigned to the active reviewer", () => {
    const records = createSeedAdmissionsRecords();
    const readyRecord = records.find((record) => record.applicationId === "app-scu-004");
    const unassignedRecord = records.find(
      (record) => record.applicationId === "app-scu-001",
    );

    expect(readyRecord).toBeDefined();
    expect(unassignedRecord).toBeDefined();
    expect(
      evaluateAdmissionsDecisionReadiness(
        readyRecord!,
        "samira.chen@keypath.com.au",
      ).ready,
    ).toBe(true);
    expect(
      evaluateAdmissionsDecisionReadiness(
        unassignedRecord!,
        "admissions.user@keypath.com.au",
      ).flags.find((flag) => flag.code === "assignee_confirmed")?.satisfied,
    ).toBe(false);
  });

  it("stores immutable admit decisions and triggers provisioning from approved states", async () => {
    const result = await captureAdmissionsDecision(createSeedAdmissionsRecords(), {
      actor: "samira.chen@keypath.com.au",
      applicationId: "app-scu-004",
      notes: "Ready for direct offer.",
      outcome: "admit",
      reasonCode: "academic-qualified",
    });
    const updated = result.records.find((record) => record.applicationId === "app-scu-004");

    expect(result.triggeredProvisioning).toBe(true);
    expect(updated?.status).toBe("provisioned");
    expect(updated?.application.status).toBe("decisioned");
    expect(getLatestAdmissionsDecision(updated!)).toMatchObject({
      decidedBy: "samira.chen@keypath.com.au",
      outcome: {
        status: "offer-made",
        reasonCode: "academic-qualified",
      },
    });
    expect(getLatestAdmissionsProvisioningJob(updated!)).toMatchObject({
      adapterMode: "file",
      status: "completed",
    });
    expect(updated?.decisionTrace.auditEvents.map((event) => event.type)).toEqual([
      "job.created",
      "job.attempt.recorded",
      "job.completed",
      "job.reconciled",
    ]);
    expect(updated?.auditEvents.at(-3)).toMatchObject({
      summary: "Decision captured: Admit (Academic qualified).",
      type: "decision",
    });
    expect(updated?.auditEvents.at(-2)).toMatchObject({
      summary: "Queue status changed to provisioned.",
      type: "status",
    });
    expect(updated?.auditEvents.at(-1)).toMatchObject({
      summary: "Provisioning trigger completed on file and is now completed.",
      type: "provisioning",
    });
  });

  it("generates a structured export in mode 2 without triggering automated provisioning", async () => {
    const result = await captureAdmissionsDecision(createSeedAdmissionsRecords(), {
      actor: "samira.chen@keypath.com.au",
      applicationId: "app-tiu-008",
      outcome: "admit",
      reasonCode: "competitive-profile",
    });
    const updated = result.records.find((record) => record.applicationId === "app-tiu-008");

    expect(result.downstreamAction).toBe("export");
    expect(result.rolloutMode).toBe("mode-2-decision-export");
    expect(result.triggeredProvisioning).toBe(false);
    expect(updated?.status).toBe("decisioned");
    expect(updated?.decisionTrace.provisioningJobs).toHaveLength(0);
    expect(getLatestAdmissionsStructuredExport(updated!)).toMatchObject({
      partnerId: "TIU",
    });
    expect(updated?.auditEvents.at(-1)).toMatchObject({
      summary: expect.stringContaining("Structured export handoff prepared"),
      type: "export",
    });
  });

  it("stores waitlist decisions without triggering downstream automation", async () => {
    const result = await captureAdmissionsDecision(createSeedAdmissionsRecords(), {
      actor: "samira.chen@keypath.com.au",
      applicationId: "app-tiu-008",
      outcome: "waitlist",
      reasonCode: "capacity-hold",
    });
    const updated = result.records.find((record) => record.applicationId === "app-tiu-008");

    expect(result.triggeredProvisioning).toBe(false);
    expect(updated?.status).toBe("decisioned");
    expect(updated?.decisionTrace.provisioningJobs).toHaveLength(0);
    expect(getLatestAdmissionsDecision(updated!)).toMatchObject({
      outcome: {
        status: "waitlisted",
        reasonCode: "capacity-hold",
      },
    });
  });

  it("blocks decision capture when the rollout mode is still review-only", async () => {
    const assigned = assignAdmissionsRecord(createSeedAdmissionsRecords(), {
      actor: "alex.wong@keypath.com.au",
      applicationId: "app-hhi-003",
      assignee: "alex.wong@keypath.com.au",
      occurredAt: "2026-03-10T12:10:00Z",
    });
    const ready = updateAdmissionsStatus(assigned, {
      actor: "alex.wong@keypath.com.au",
      applicationId: "app-hhi-003",
      occurredAt: "2026-03-10T12:12:00Z",
      status: "ready-for-decision",
    });

    await expect(
      captureAdmissionsDecision(ready, {
        actor: "alex.wong@keypath.com.au",
        applicationId: "app-hhi-003",
        outcome: "reject",
        reasonCode: "academic-not-met",
      }),
    ).rejects.toThrow(/Mode 1|review-only/i);
  });

  it("uses the portal-rpa fallback adapter when an HHI course line is promoted to mode 3", async () => {
    const ready = updateAdmissionsStatus(
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
    const rolloutResult = transitionPartnerCourseRolloutMode(
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

    const result = await captureAdmissionsDecision(ready, {
      actor: "alex.wong@keypath.com.au",
      applicationId: "app-hhi-003",
      outcome: "admit",
      reasonCode: "competitive-profile",
      rolloutConfigs: rolloutResult.configs,
    });
    const updated = result.records.find((record) => record.applicationId === "app-hhi-003");

    expect(result.rolloutMode).toBe("mode-3-automated-provisioning");
    expect(result.triggeredProvisioning).toBe(true);
    expect(getLatestAdmissionsProvisioningJob(updated!)).toMatchObject({
      adapterMode: "portal-rpa",
      status: "completed",
    });
    expect(getLatestAdmissionsPortalRpaRun(updated!)).toMatchObject({
      runState: "completed",
    });
    expect(getLatestAdmissionsPortalRpaDriftSignal(updated!)).toBeUndefined();
    expect(updated?.decisionTrace.portalRpaEvidence.map((event) => event.stepKey)).toContain(
      "portal.submit-decision",
    );
  });

  it("rejects decision capture when readiness checks fail", async () => {
    await expect(
      captureAdmissionsDecision(createSeedAdmissionsRecords(), {
        actor: "admissions.user@keypath.com.au",
        applicationId: "app-scu-001",
        outcome: "reject",
        reasonCode: "academic-not-met",
      }),
    ).rejects.toThrow(/ready for decision|Assign this application to yourself/i);
  });
});
