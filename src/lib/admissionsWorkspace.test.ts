import { describe, expect, it } from "vitest";
import {
  addAdmissionsNote,
  assignAdmissionsRecord,
  createSeedAdmissionsRecords,
  updateAdmissionsStatus,
} from "./admissionsWorkspace";

describe("admissionsWorkspace", () => {
  it("seeds one admissions queue record per canonical sample application", () => {
    const records = createSeedAdmissionsRecords();

    expect(records).toHaveLength(3);
    expect(records[0]).toMatchObject({
      applicationId: "app-scu-001",
      priority: "high",
      status: "new",
    });
    expect(records[1].assignee).toBe("samira.chen@keypath.com.au");
  });

  it("records assignment changes with actor and timestamp", () => {
    const records = assignAdmissionsRecord(createSeedAdmissionsRecords(), {
      actor: "lead.reviewer@keypath.com.au",
      applicationId: "app-scu-001",
      assignee: "casey.ng@keypath.com.au",
      occurredAt: "2026-03-10T10:00:00Z",
    });
    const updated = records.find((record) => record.applicationId === "app-scu-001");

    expect(updated).toMatchObject({
      assignee: "casey.ng@keypath.com.au",
      assignedAt: "2026-03-10T10:00:00Z",
      assignedBy: "lead.reviewer@keypath.com.au",
      status: "assigned",
    });
    expect(updated?.auditEvents.at(-2)).toMatchObject({
      actor: "lead.reviewer@keypath.com.au",
      occurredAt: "2026-03-10T10:00:00Z",
      type: "assignment",
    });
    expect(updated?.auditEvents.at(-1)).toMatchObject({
      actor: "lead.reviewer@keypath.com.au",
      summary: "Queue status changed to assigned.",
      type: "status",
    });
  });

  it("stores notes and explicit status transitions for operational handover", () => {
    const withStatus = updateAdmissionsStatus(createSeedAdmissionsRecords(), {
      actor: "alex.wong@keypath.com.au",
      applicationId: "app-hhi-003",
      occurredAt: "2026-03-10T10:15:00Z",
      status: "ready-for-decision",
    });
    const withNote = addAdmissionsNote(withStatus, {
      applicationId: "app-hhi-003",
      author: "alex.wong@keypath.com.au",
      body: "Placement evidence confirmed. Handing over for decision capture.",
      createdAt: "2026-03-10T10:20:00Z",
    });
    const updated = withNote.find((record) => record.applicationId === "app-hhi-003");

    expect(updated?.status).toBe("ready-for-decision");
    expect(updated?.notes[0]).toMatchObject({
      author: "alex.wong@keypath.com.au",
      createdAt: "2026-03-10T10:20:00Z",
    });
    expect(updated?.notes[0].body).toContain("Placement evidence confirmed");
    expect(updated?.auditEvents.at(-2)).toMatchObject({
      actor: "alex.wong@keypath.com.au",
      summary: "Queue status changed to ready-for-decision.",
      type: "status",
    });
    expect(updated?.auditEvents.at(-1)).toMatchObject({
      actor: "alex.wong@keypath.com.au",
      summary: "Operational handover note added.",
      type: "note",
    });
  });
});
