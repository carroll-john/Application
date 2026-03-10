import { describe, expect, it } from "vitest";
import {
  addAdmissionsNote,
  assignAdmissionsRecord,
  buildAdmissionsDocumentPreview,
  buildAdmissionsQueueSearchParams,
  createSeedAdmissionsRecords,
  evaluateAdmissionsDocumentAccess,
  filterAdmissionsQueueRecords,
  paginateAdmissionsQueueRecords,
  readAdmissionsQueueSearchState,
  requestAdmissionsDocumentAccess,
  updateAdmissionsStatus,
} from "./admissionsWorkspace";

describe("admissionsWorkspace", () => {
  it("seeds a pilot-sized admissions queue with unique application records", () => {
    const records = createSeedAdmissionsRecords();

    expect(records).toHaveLength(9);
    expect(new Set(records.map((record) => record.applicationId)).size).toBe(9);
    expect(records[0]).toMatchObject({
      applicationId: "app-scu-001",
      priority: "high",
      status: "new",
    });
    expect(records[1].assignee).toBe("samira.chen@keypath.com.au");
    expect(records.at(-1)).toMatchObject({
      applicationId: "app-hhi-009",
      status: "new",
    });
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

  it("filters the admissions queue by partner, course line, assignee, and applicant/application identifiers", () => {
    const records = createSeedAdmissionsRecords();

    const filtered = filterAdmissionsQueueRecords(records, {
      actor: "samira.chen@keypath.com.au",
      searchState: {
        assignee: "mine",
        courseLine: "GC-PM",
        page: 1,
        partner: "Tasman Institute of Technology",
        query: "app-tiu-008",
        status: "ready-for-decision",
      },
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]).toMatchObject({
      applicationId: "app-tiu-008",
      assignee: "samira.chen@keypath.com.au",
      status: "ready-for-decision",
    });
  });

  it("serializes shareable queue state and paginates pilot-volume results", () => {
    const searchParams = buildAdmissionsQueueSearchParams({
      assignee: "unassigned",
      courseLine: "BN-HEALTH",
      page: 2,
      partner: "Harbour Health Institute",
      query: "app-hhi",
      status: "new",
    });

    expect(searchParams.toString()).toBe(
      "q=app-hhi&status=new&assignee=unassigned&partner=Harbour+Health+Institute&course=BN-HEALTH&page=2",
    );
    expect(readAdmissionsQueueSearchState(searchParams)).toEqual({
      assignee: "unassigned",
      courseLine: "BN-HEALTH",
      page: 2,
      partner: "Harbour Health Institute",
      query: "app-hhi",
      status: "new",
    });

    const pagination = paginateAdmissionsQueueRecords(
      filterAdmissionsQueueRecords(createSeedAdmissionsRecords(), {
        actor: "admissions.user@keypath.com.au",
        searchState: {
          assignee: "all",
          courseLine: "all",
          page: 1,
          partner: "all",
          query: "",
          status: "all",
        },
      }),
      3,
      4,
    );

    expect(pagination).toMatchObject({
      page: 3,
      startRecord: 9,
      endRecord: 9,
      totalPages: 3,
      totalRecords: 9,
    });
    expect(pagination.records).toHaveLength(1);
  });

  it("blocks document access when the application is assigned to a different reviewer and records the attempt", () => {
    const records = createSeedAdmissionsRecords();
    const record = records.find((candidate) => candidate.applicationId === "app-hhi-003");

    expect(record).toBeDefined();
    expect(
      evaluateAdmissionsDocumentAccess(
        record!,
        "samira.chen@keypath.com.au",
      ),
    ).toMatchObject({
      allowed: false,
      reasonCode: "assignee_mismatch",
    });

    const access = requestAdmissionsDocumentAccess(records, {
      actor: "samira.chen@keypath.com.au",
      applicationId: "app-hhi-003",
      documentId: "doc-006",
      occurredAt: "2026-03-10T11:15:00Z",
    });
    const updated = access.records.find(
      (candidate) => candidate.applicationId === "app-hhi-003",
    );

    expect(access).toMatchObject({
      allowed: false,
      occurredAt: "2026-03-10T11:15:00Z",
      reasonCode: "assignee_mismatch",
    });
    expect(access.reason).toContain("alex.wong@keypath.com.au");
    expect(updated?.auditEvents.at(-1)).toMatchObject({
      actor: "samira.chen@keypath.com.au",
      metadata: {
        documentCategory: "certificate",
        documentId: "doc-006",
        outcome: "blocked",
        reasonCode: "assignee_mismatch",
      },
      summary: "Blocked document viewer access for allied-health-cert.pdf.",
      type: "document-access",
    });
  });

  it("logs successful document access and watermarks the protected preview with reviewer metadata", () => {
    const access = requestAdmissionsDocumentAccess(createSeedAdmissionsRecords(), {
      actor: "samira.chen@keypath.com.au",
      applicationId: "app-tiu-008",
      documentId: "doc-003",
      occurredAt: "2026-03-10T11:20:00Z",
    });
    const updated = access.records.find(
      (candidate) => candidate.applicationId === "app-tiu-008",
    );

    expect(access).toMatchObject({
      allowed: true,
      occurredAt: "2026-03-10T11:20:00Z",
      reasonCode: "ok",
    });
    expect(updated?.auditEvents.at(-1)).toMatchObject({
      actor: "samira.chen@keypath.com.au",
      metadata: {
        documentCategory: "transcript",
        documentId: "doc-003",
        outcome: "opened",
        reasonCode: "ok",
      },
      summary: "Opened protected document viewer for analytics-transcript.pdf.",
      type: "document-access",
    });

    const preview = buildAdmissionsDocumentPreview(updated!, access.document!, {
      actor: "samira.chen@keypath.com.au",
      accessedAt: "2026-03-10T11:20:00Z",
    });

    expect(preview).toContain("Viewer samira.chen@keypath.com.au");
    expect(preview).toContain("Access logged 2026-03-10T11:20:00Z");
    expect(preview).toContain("Protected preview");
  });
});
