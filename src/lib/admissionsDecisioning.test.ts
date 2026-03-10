import { describe, expect, it } from "vitest";
import { createSeedAdmissionsRecords } from "./admissionsWorkspace";
import {
  captureAdmissionsDecision,
  evaluateAdmissionsDecisionReadiness,
  getLatestAdmissionsDecision,
  getLatestAdmissionsProvisioningJob,
} from "./admissionsDecisioning";

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

  it("stores waitlist decisions without triggering provisioning", async () => {
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
