import type {
  CanonicalApplicationV1,
  CanonicalDocumentReference,
} from "../integrationPlatform/contracts";
import { canonicalApplicationSamples } from "../integrationPlatform/examples";

export const ADMISSIONS_WORKSPACE_STORAGE_KEY =
  "application-prototype:admissions-workspace:v2";

export const ADMISSIONS_QUEUE_PAGE_SIZE = 6;

export type AdmissionsQueueStatus =
  | "new"
  | "assigned"
  | "under-review"
  | "ready-for-decision";

export type AdmissionsPriority = "high" | "medium" | "normal";

export type AdmissionsAuditEventType =
  | "assignment"
  | "status"
  | "note"
  | "document-access";

export type AdmissionsStatusFilter = "all" | AdmissionsQueueStatus;

export type AdmissionsAssigneeFilter = "all" | "mine" | "unassigned";

export interface AdmissionsQueueSearchState {
  assignee: AdmissionsAssigneeFilter;
  courseLine: string;
  page: number;
  partner: string;
  query: string;
  status: AdmissionsStatusFilter;
}

export interface AdmissionsQueueFilterOption {
  label: string;
  value: string;
}

export interface AdmissionsQueuePage {
  endRecord: number;
  page: number;
  pageSize: number;
  records: AdmissionsQueueRecord[];
  startRecord: number;
  totalPages: number;
  totalRecords: number;
}

export const DEFAULT_ADMISSIONS_QUEUE_SEARCH_STATE: AdmissionsQueueSearchState = {
  assignee: "all",
  courseLine: "all",
  page: 1,
  partner: "all",
  query: "",
  status: "all",
};

const ADMISSIONS_STATUS_FILTER_VALUES = new Set<AdmissionsStatusFilter>([
  "all",
  "new",
  "assigned",
  "under-review",
  "ready-for-decision",
]);

const ADMISSIONS_ASSIGNEE_FILTER_VALUES = new Set<AdmissionsAssigneeFilter>([
  "all",
  "mine",
  "unassigned",
]);

export interface AdmissionsNote {
  author: string;
  body: string;
  createdAt: string;
  noteId: string;
}

export interface AdmissionsAuditEventMetadata {
  documentCategory?: string;
  documentId?: string;
  outcome?: "opened" | "blocked";
  reasonCode?: AdmissionsDocumentAccessReasonCode;
}

export interface AdmissionsAuditEvent {
  actor: string;
  eventId: string;
  metadata?: AdmissionsAuditEventMetadata;
  occurredAt: string;
  summary: string;
  type: AdmissionsAuditEventType;
}

export type AdmissionsDocumentAccessReasonCode =
  | "ok"
  | "reviewer_required"
  | "record_not_found"
  | "document_not_found"
  | "assignee_mismatch";

export interface AdmissionsDocumentAccessDecision {
  allowed: boolean;
  document?: CanonicalDocumentReference;
  occurredAt: string;
  reason?: string;
  reasonCode: AdmissionsDocumentAccessReasonCode;
  records: AdmissionsQueueRecord[];
}

export interface AdmissionsQueueRecord {
  application: CanonicalApplicationV1;
  applicationId: string;
  assignedAt?: string;
  assignedBy?: string;
  assignee?: string;
  auditEvents: AdmissionsAuditEvent[];
  lastActivityAt: string;
  notes: AdmissionsNote[];
  priority: AdmissionsPriority;
  status: AdmissionsQueueStatus;
}

function sanitizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function cloneApplication(
  application: CanonicalApplicationV1,
): CanonicalApplicationV1 {
  return JSON.parse(JSON.stringify(application)) as CanonicalApplicationV1;
}

function cloneNote(note: AdmissionsNote): AdmissionsNote {
  return {
    ...note,
  };
}

function cloneAuditEvent(event: AdmissionsAuditEvent): AdmissionsAuditEvent {
  return {
    ...event,
    metadata: event.metadata ? { ...event.metadata } : undefined,
  };
}

function cloneRecord(record: AdmissionsQueueRecord): AdmissionsQueueRecord {
  return {
    ...record,
    application: cloneApplication(record.application),
    auditEvents: record.auditEvents.map((event) => cloneAuditEvent(event)),
    notes: record.notes.map((note) => cloneNote(note)),
  };
}

export function cloneAdmissionsRecords(
  records: AdmissionsQueueRecord[],
): AdmissionsQueueRecord[] {
  return records.map((record) => cloneRecord(record));
}

function createAdmissionsSeedApplication(input: {
  applicantId: string;
  applicationId: string;
  baseApplication: CanonicalApplicationV1;
  email: string;
  firstName: string;
  lastName: string;
  submittedAt: string;
}): CanonicalApplicationV1 {
  const application = cloneApplication(input.baseApplication);
  application.applicantId = input.applicantId;
  application.applicationId = input.applicationId;
  application.personalDetails.email = input.email;
  application.personalDetails.firstName = input.firstName;
  application.personalDetails.lastName = input.lastName;
  application.submittedAt = input.submittedAt;
  return application;
}

function getAdmissionsCourseLineLabel(record: AdmissionsQueueRecord): string {
  return `${record.application.selectedCourse.courseTitle} (${record.application.selectedCourse.courseCode})`;
}

function getAdmissionsSearchText(record: AdmissionsQueueRecord): string {
  return [
    record.application.applicationId,
    record.application.applicantId,
    record.application.personalDetails.firstName,
    record.application.personalDetails.lastName,
    record.application.personalDetails.email,
    record.application.selectedCourse.providerCode,
    record.application.selectedCourse.providerName,
    record.application.selectedCourse.courseCode,
    record.application.selectedCourse.courseTitle,
  ]
    .join(" ")
    .toLowerCase();
}

export function getAdmissionsQueuePartnerOptions(
  records: AdmissionsQueueRecord[],
): AdmissionsQueueFilterOption[] {
  return Array.from(
    new Map(
      records.map((record) => [
        record.application.selectedCourse.providerName,
        {
          label: record.application.selectedCourse.providerName,
          value: record.application.selectedCourse.providerName,
        } satisfies AdmissionsQueueFilterOption,
      ]),
    ).values(),
  ).sort((left, right) => left.label.localeCompare(right.label));
}

export function getAdmissionsQueueCourseLineOptions(
  records: AdmissionsQueueRecord[],
): AdmissionsQueueFilterOption[] {
  return Array.from(
    new Map(
      records.map((record) => [
        record.application.selectedCourse.courseCode,
        {
          label: getAdmissionsCourseLineLabel(record),
          value: record.application.selectedCourse.courseCode,
        } satisfies AdmissionsQueueFilterOption,
      ]),
    ).values(),
  ).sort((left, right) => left.label.localeCompare(right.label));
}

export function readAdmissionsQueueSearchState(
  searchParams: URLSearchParams,
): AdmissionsQueueSearchState {
  const status = searchParams.get("status");
  const assignee = searchParams.get("assignee");
  const rawPage = Number.parseInt(searchParams.get("page") ?? "", 10);

  return {
    assignee: ADMISSIONS_ASSIGNEE_FILTER_VALUES.has(
      assignee as AdmissionsAssigneeFilter,
    )
      ? (assignee as AdmissionsAssigneeFilter)
      : DEFAULT_ADMISSIONS_QUEUE_SEARCH_STATE.assignee,
    courseLine:
      searchParams.get("course")?.trim() ||
      DEFAULT_ADMISSIONS_QUEUE_SEARCH_STATE.courseLine,
    page:
      Number.isFinite(rawPage) && rawPage > 0
        ? rawPage
        : DEFAULT_ADMISSIONS_QUEUE_SEARCH_STATE.page,
    partner:
      searchParams.get("partner")?.trim() ||
      DEFAULT_ADMISSIONS_QUEUE_SEARCH_STATE.partner,
    query:
      searchParams.get("q") ?? DEFAULT_ADMISSIONS_QUEUE_SEARCH_STATE.query,
    status: ADMISSIONS_STATUS_FILTER_VALUES.has(status as AdmissionsStatusFilter)
      ? (status as AdmissionsStatusFilter)
      : DEFAULT_ADMISSIONS_QUEUE_SEARCH_STATE.status,
  };
}

export function buildAdmissionsQueueSearchParams(
  state: AdmissionsQueueSearchState,
): URLSearchParams {
  const params = new URLSearchParams();

  if (state.query.trim()) {
    params.set("q", state.query.trim());
  }

  if (state.status !== DEFAULT_ADMISSIONS_QUEUE_SEARCH_STATE.status) {
    params.set("status", state.status);
  }

  if (state.assignee !== DEFAULT_ADMISSIONS_QUEUE_SEARCH_STATE.assignee) {
    params.set("assignee", state.assignee);
  }

  if (state.partner !== DEFAULT_ADMISSIONS_QUEUE_SEARCH_STATE.partner) {
    params.set("partner", state.partner);
  }

  if (state.courseLine !== DEFAULT_ADMISSIONS_QUEUE_SEARCH_STATE.courseLine) {
    params.set("course", state.courseLine);
  }

  if (state.page > DEFAULT_ADMISSIONS_QUEUE_SEARCH_STATE.page) {
    params.set("page", String(state.page));
  }

  return params;
}

export function filterAdmissionsQueueRecords(
  records: AdmissionsQueueRecord[],
  input: {
    actor: string;
    searchState: AdmissionsQueueSearchState;
  },
): AdmissionsQueueRecord[] {
  const normalizedQuery = input.searchState.query.trim().toLowerCase();

  return cloneAdmissionsRecords(records)
    .filter((record) =>
      input.searchState.status === "all"
        ? true
        : record.status === input.searchState.status,
    )
    .filter((record) => {
      if (input.searchState.assignee === "all") {
        return true;
      }

      if (input.searchState.assignee === "mine") {
        return record.assignee === input.actor;
      }

      return !record.assignee;
    })
    .filter((record) =>
      input.searchState.partner === "all"
        ? true
        : record.application.selectedCourse.providerName === input.searchState.partner,
    )
    .filter((record) =>
      input.searchState.courseLine === "all"
        ? true
        : record.application.selectedCourse.courseCode === input.searchState.courseLine,
    )
    .filter((record) =>
      normalizedQuery ? getAdmissionsSearchText(record).includes(normalizedQuery) : true,
    )
    .sort((left, right) => right.lastActivityAt.localeCompare(left.lastActivityAt));
}

export function paginateAdmissionsQueueRecords(
  records: AdmissionsQueueRecord[],
  page: number,
  pageSize = ADMISSIONS_QUEUE_PAGE_SIZE,
): AdmissionsQueuePage {
  const safePageSize = Math.max(1, pageSize);
  const totalRecords = records.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / safePageSize));
  const normalizedPage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (normalizedPage - 1) * safePageSize;
  const pagedRecords = records.slice(startIndex, startIndex + safePageSize);

  return {
    endRecord: totalRecords === 0 ? 0 : startIndex + pagedRecords.length,
    page: normalizedPage,
    pageSize: safePageSize,
    records: pagedRecords,
    startRecord: totalRecords === 0 ? 0 : startIndex + 1,
    totalPages,
    totalRecords,
  };
}

function createAuditEvent(input: {
  applicationId: string;
  actor: string;
  metadata?: AdmissionsAuditEventMetadata;
  occurredAt: string;
  summary: string;
  type: AdmissionsAuditEventType;
}): AdmissionsAuditEvent {
  return {
    actor: input.actor,
    eventId: [
      "admissions",
      sanitizeToken(input.applicationId),
      sanitizeToken(input.type),
      input.metadata?.documentId ? sanitizeToken(input.metadata.documentId) : "",
      String(Date.parse(input.occurredAt)),
    ]
      .filter(Boolean)
      .join("-"),
    metadata: input.metadata ? { ...input.metadata } : undefined,
    occurredAt: input.occurredAt,
    summary: input.summary,
    type: input.type,
  };
}

function createNote(input: {
  applicationId: string;
  author: string;
  body: string;
  createdAt: string;
}): AdmissionsNote {
  return {
    author: input.author,
    body: input.body,
    createdAt: input.createdAt,
    noteId: [
      "note",
      sanitizeToken(input.applicationId),
      String(Date.parse(input.createdAt)),
    ].join("-"),
  };
}

interface SeedConfig {
  assignedAt?: string;
  assignedBy?: string;
  assignee?: string;
  initialNote?: {
    author: string;
    body: string;
    createdAt: string;
  };
  lastActivityAt: string;
  priority: AdmissionsPriority;
  status: AdmissionsQueueStatus;
}

function createSeedRecord(
  application: CanonicalApplicationV1,
  config: SeedConfig,
): AdmissionsQueueRecord {
  const notes = config.initialNote
    ? [
        createNote({
          applicationId: application.applicationId,
          author: config.initialNote.author,
          body: config.initialNote.body,
          createdAt: config.initialNote.createdAt,
        }),
      ]
    : [];
  const auditEvents: AdmissionsAuditEvent[] = [
    createAuditEvent({
      applicationId: application.applicationId,
      actor: "system.seed",
      occurredAt: application.submittedAt ?? config.lastActivityAt,
      summary: `Application seeded into admissions queue as ${config.status}.`,
      type: "status",
    }),
  ];

  if (config.assignee && config.assignedAt && config.assignedBy) {
    auditEvents.push(
      createAuditEvent({
        applicationId: application.applicationId,
        actor: config.assignedBy,
        occurredAt: config.assignedAt,
        summary: `Assigned to ${config.assignee}.`,
        type: "assignment",
      }),
    );
  }

  if (config.initialNote) {
    auditEvents.push(
      createAuditEvent({
        applicationId: application.applicationId,
        actor: config.initialNote.author,
        occurredAt: config.initialNote.createdAt,
        summary: "Operational handover note added.",
        type: "note",
      }),
    );
  }

  return {
    application: cloneApplication(application),
    applicationId: application.applicationId,
    assignedAt: config.assignedAt,
    assignedBy: config.assignedBy,
    assignee: config.assignee,
    auditEvents,
    lastActivityAt: config.lastActivityAt,
    notes,
    priority: config.priority,
    status: config.status,
  };
}

export function createSeedAdmissionsRecords(): AdmissionsQueueRecord[] {
  const seedRows: Array<
    SeedConfig & {
      applicantId: string;
      applicationId: string;
      baseIndex: number;
      email: string;
      firstName: string;
      lastName: string;
      submittedAt: string;
    }
  > = [
    {
      applicantId: "applicant-scu-001",
      applicationId: "app-scu-001",
      baseIndex: 0,
      email: "morgan.lee@example.com",
      firstName: "Morgan",
      lastName: "Lee",
      lastActivityAt: "2026-03-10T09:05:00Z",
      priority: "high",
      status: "new",
      submittedAt: "2026-03-10T08:55:00Z",
    },
    {
      applicantId: "applicant-tiu-002",
      applicationId: "app-tiu-002",
      assignee: "samira.chen@keypath.com.au",
      assignedAt: "2026-03-10T09:20:00Z",
      assignedBy: "ops.lead@keypath.com.au",
      baseIndex: 1,
      email: "priya.nair@example.com",
      firstName: "Priya",
      initialNote: {
        author: "samira.chen@keypath.com.au",
        body: "Flagged for language-evidence review before decisioning.",
        createdAt: "2026-03-10T09:24:00Z",
      },
      lastActivityAt: "2026-03-10T09:24:00Z",
      lastName: "Nair",
      priority: "high",
      status: "assigned",
      submittedAt: "2026-03-10T09:10:00Z",
    },
    {
      applicantId: "applicant-hhi-003",
      applicationId: "app-hhi-003",
      assignee: "alex.wong@keypath.com.au",
      assignedAt: "2026-03-10T09:40:00Z",
      assignedBy: "ops.lead@keypath.com.au",
      baseIndex: 2,
      email: "liam.carter@example.com",
      firstName: "Liam",
      initialNote: {
        author: "alex.wong@keypath.com.au",
        body: "Clinical placement evidence looks complete. Ready for final review.",
        createdAt: "2026-03-10T09:48:00Z",
      },
      lastActivityAt: "2026-03-10T09:48:00Z",
      lastName: "Carter",
      priority: "medium",
      status: "under-review",
      submittedAt: "2026-03-10T09:30:00Z",
    },
    {
      applicantId: "applicant-scu-004",
      applicationId: "app-scu-004",
      assignee: "samira.chen@keypath.com.au",
      assignedAt: "2026-03-10T10:05:00Z",
      assignedBy: "ops.lead@keypath.com.au",
      baseIndex: 0,
      email: "ava.thompson@example.com",
      firstName: "Ava",
      lastActivityAt: "2026-03-10T10:12:00Z",
      lastName: "Thompson",
      priority: "medium",
      status: "ready-for-decision",
      submittedAt: "2026-03-10T09:58:00Z",
    },
    {
      applicantId: "applicant-tiu-005",
      applicationId: "app-tiu-005",
      baseIndex: 1,
      email: "noah.kim@example.com",
      firstName: "Noah",
      lastActivityAt: "2026-03-10T10:18:00Z",
      lastName: "Kim",
      priority: "normal",
      status: "new",
      submittedAt: "2026-03-10T10:12:00Z",
    },
    {
      applicantId: "applicant-hhi-006",
      applicationId: "app-hhi-006",
      assignee: "casey.ng@keypath.com.au",
      assignedAt: "2026-03-10T10:28:00Z",
      assignedBy: "ops.lead@keypath.com.au",
      baseIndex: 2,
      email: "mia.patel@example.com",
      firstName: "Mia",
      initialNote: {
        author: "casey.ng@keypath.com.au",
        body: "Need one more cross-check on nursing registration evidence.",
        createdAt: "2026-03-10T10:33:00Z",
      },
      lastActivityAt: "2026-03-10T10:33:00Z",
      lastName: "Patel",
      priority: "high",
      status: "assigned",
      submittedAt: "2026-03-10T10:24:00Z",
    },
    {
      applicantId: "applicant-scu-007",
      applicationId: "app-scu-007",
      assignee: "alex.wong@keypath.com.au",
      assignedAt: "2026-03-10T10:42:00Z",
      assignedBy: "ops.lead@keypath.com.au",
      baseIndex: 0,
      email: "ethan.clarke@example.com",
      firstName: "Ethan",
      lastActivityAt: "2026-03-10T10:48:00Z",
      lastName: "Clarke",
      priority: "normal",
      status: "under-review",
      submittedAt: "2026-03-10T10:39:00Z",
    },
    {
      applicantId: "applicant-tiu-008",
      applicationId: "app-tiu-008",
      assignee: "samira.chen@keypath.com.au",
      assignedAt: "2026-03-10T10:56:00Z",
      assignedBy: "ops.lead@keypath.com.au",
      baseIndex: 1,
      email: "sophie.nguyen@example.com",
      firstName: "Sophie",
      lastActivityAt: "2026-03-10T11:02:00Z",
      lastName: "Nguyen",
      priority: "medium",
      status: "ready-for-decision",
      submittedAt: "2026-03-10T10:52:00Z",
    },
    {
      applicantId: "applicant-hhi-009",
      applicationId: "app-hhi-009",
      baseIndex: 2,
      email: "grace.wilson@example.com",
      firstName: "Grace",
      lastActivityAt: "2026-03-10T11:12:00Z",
      lastName: "Wilson",
      priority: "high",
      status: "new",
      submittedAt: "2026-03-10T11:06:00Z",
    },
  ];

  return seedRows.map((row) =>
    createSeedRecord(
      createAdmissionsSeedApplication({
        applicantId: row.applicantId,
        applicationId: row.applicationId,
        baseApplication: canonicalApplicationSamples[row.baseIndex],
        email: row.email,
        firstName: row.firstName,
        lastName: row.lastName,
        submittedAt: row.submittedAt,
      }),
      row,
    ),
  );
}

export function loadAdmissionsWorkspaceRecords(): AdmissionsQueueRecord[] {
  if (typeof window === "undefined") {
    return createSeedAdmissionsRecords();
  }

  try {
    const storedValue = window.localStorage.getItem(ADMISSIONS_WORKSPACE_STORAGE_KEY);

    if (storedValue) {
      const parsed = JSON.parse(storedValue) as AdmissionsQueueRecord[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return cloneAdmissionsRecords(parsed);
      }
    }
  } catch {
    // Fall back to seeded state.
  }

  const seeded = createSeedAdmissionsRecords();
  saveAdmissionsWorkspaceRecords(seeded);
  return seeded;
}

export function saveAdmissionsWorkspaceRecords(
  records: AdmissionsQueueRecord[],
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      ADMISSIONS_WORKSPACE_STORAGE_KEY,
      JSON.stringify(records),
    );
  } catch {
    // Ignore storage failures and keep in-memory state.
  }
}

export function findAdmissionsRecord(
  records: AdmissionsQueueRecord[],
  applicationId: string,
): AdmissionsQueueRecord | undefined {
  return cloneAdmissionsRecords(records).find(
    (record) => record.applicationId === applicationId,
  );
}

function normalizeAdmissionsActor(actor: string): string {
  return actor.trim().toLowerCase();
}

export function evaluateAdmissionsDocumentAccess(
  record: AdmissionsQueueRecord,
  actor: string,
): Pick<
  AdmissionsDocumentAccessDecision,
  "allowed" | "reason" | "reasonCode"
> {
  const normalizedActor = normalizeAdmissionsActor(actor);
  const normalizedAssignee = record.assignee
    ? normalizeAdmissionsActor(record.assignee)
    : "";

  if (!normalizedActor) {
    return {
      allowed: false,
      reason:
        "A signed-in admissions reviewer is required before protected evidence can be opened.",
      reasonCode: "reviewer_required",
    };
  }

  if (normalizedAssignee && normalizedAssignee !== normalizedActor) {
    return {
      allowed: false,
      reason: `Protected evidence is assigned to ${record.assignee}. Reassign this application before opening documents.`,
      reasonCode: "assignee_mismatch",
    };
  }

  return {
    allowed: true,
    reasonCode: "ok",
  };
}

export function requestAdmissionsDocumentAccess(
  records: AdmissionsQueueRecord[],
  input: {
    actor: string;
    applicationId: string;
    documentId: string;
    occurredAt?: string;
  },
): AdmissionsDocumentAccessDecision {
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const nextRecords = cloneAdmissionsRecords(records);
  const record = nextRecords.find(
    (candidate) => candidate.applicationId === input.applicationId,
  );

  if (!record) {
    return {
      allowed: false,
      occurredAt,
      reason:
        "This admissions item is no longer available. Return to the queue and reopen it before viewing documents.",
      reasonCode: "record_not_found",
      records: nextRecords,
    };
  }

  const document = record.application.documents.find(
    (candidate) => candidate.documentId === input.documentId,
  );

  if (!document) {
    record.auditEvents.push(
      createAuditEvent({
        applicationId: record.applicationId,
        actor: input.actor,
        metadata: {
          documentId: input.documentId,
          outcome: "blocked",
          reasonCode: "document_not_found",
        },
        occurredAt,
        summary: "Blocked document viewer access because the requested document was not found.",
        type: "document-access",
      }),
    );
    record.lastActivityAt = occurredAt;

    return {
      allowed: false,
      occurredAt,
      reason:
        "The requested document is no longer attached to this application. Refresh the review workspace and try again.",
      reasonCode: "document_not_found",
      records: nextRecords,
    };
  }

  const accessDecision = evaluateAdmissionsDocumentAccess(record, input.actor);

  record.auditEvents.push(
    createAuditEvent({
      applicationId: record.applicationId,
      actor: input.actor,
      metadata: {
        documentCategory: document.category,
        documentId: document.documentId,
        outcome: accessDecision.allowed ? "opened" : "blocked",
        reasonCode: accessDecision.reasonCode,
      },
      occurredAt,
      summary: accessDecision.allowed
        ? `Opened protected document viewer for ${document.filename}.`
        : `Blocked document viewer access for ${document.filename}.`,
      type: "document-access",
    }),
  );
  record.lastActivityAt = occurredAt;

  return {
    allowed: accessDecision.allowed,
    document,
    occurredAt,
    reason: accessDecision.reason,
    reasonCode: accessDecision.reasonCode,
    records: nextRecords,
  };
}

export function assignAdmissionsRecord(
  records: AdmissionsQueueRecord[],
  input: {
    actor: string;
    applicationId: string;
    assignee?: string;
    occurredAt?: string;
  },
): AdmissionsQueueRecord[] {
  const occurredAt = input.occurredAt ?? new Date().toISOString();

  return cloneAdmissionsRecords(records).map((record) => {
    if (record.applicationId !== input.applicationId) {
      return record;
    }

    const nextStatus = input.assignee
      ? record.status === "new"
        ? "assigned"
        : record.status
      : record.status === "assigned"
        ? "new"
        : record.status;
    const auditEvents = [
      ...record.auditEvents,
      createAuditEvent({
        applicationId: record.applicationId,
        actor: input.actor,
        occurredAt,
        summary: input.assignee
          ? `Assigned to ${input.assignee}.`
          : "Assignment cleared.",
        type: "assignment",
      }),
    ];

    if (nextStatus !== record.status) {
      auditEvents.push(
        createAuditEvent({
          applicationId: record.applicationId,
          actor: input.actor,
          occurredAt,
          summary: `Queue status changed to ${nextStatus}.`,
          type: "status",
        }),
      );
    }

    return {
      ...record,
      assignedAt: input.assignee ? occurredAt : undefined,
      assignedBy: input.assignee ? input.actor : undefined,
      assignee: input.assignee,
      auditEvents,
      lastActivityAt: occurredAt,
      status: nextStatus,
    };
  });
}

export function updateAdmissionsStatus(
  records: AdmissionsQueueRecord[],
  input: {
    actor: string;
    applicationId: string;
    occurredAt?: string;
    status: AdmissionsQueueStatus;
  },
): AdmissionsQueueRecord[] {
  const occurredAt = input.occurredAt ?? new Date().toISOString();

  return cloneAdmissionsRecords(records).map((record) => {
    if (record.applicationId !== input.applicationId || record.status === input.status) {
      return record;
    }

    return {
      ...record,
      auditEvents: [
        ...record.auditEvents,
        createAuditEvent({
          applicationId: record.applicationId,
          actor: input.actor,
          occurredAt,
          summary: `Queue status changed to ${input.status}.`,
          type: "status",
        }),
      ],
      lastActivityAt: occurredAt,
      status: input.status,
    };
  });
}

export function addAdmissionsNote(
  records: AdmissionsQueueRecord[],
  input: {
    applicationId: string;
    author: string;
    body: string;
    createdAt?: string;
  },
): AdmissionsQueueRecord[] {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const trimmedBody = input.body.trim();

  if (!trimmedBody) {
    return cloneAdmissionsRecords(records);
  }

  return cloneAdmissionsRecords(records).map((record) => {
    if (record.applicationId !== input.applicationId) {
      return record;
    }

    return {
      ...record,
      auditEvents: [
        ...record.auditEvents,
        createAuditEvent({
          applicationId: record.applicationId,
          actor: input.author,
          occurredAt: createdAt,
          summary: "Operational handover note added.",
          type: "note",
        }),
      ],
      lastActivityAt: createdAt,
      notes: [
        createNote({
          applicationId: record.applicationId,
          author: input.author,
          body: trimmedBody,
          createdAt,
        }),
        ...record.notes,
      ],
    };
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildDocumentEvidenceSummary(
  application: CanonicalApplicationV1,
  document: CanonicalDocumentReference,
): string[] {
  if (document.category === "transcript" || document.category === "certificate") {
    return application.qualifications
      .filter((qualification) => qualification.documentIds.includes(document.documentId))
      .map(
        (qualification) =>
          `${qualification.institutionName} | ${qualification.courseName} | ${qualification.level}`,
      );
  }

  if (document.category === "language-test") {
    return application.languageTests
      .filter((test) => test.documentIds.includes(document.documentId))
      .map((test) => `${test.provider} ${test.testName} | Score ${test.overallScore ?? "pending"}`);
  }

  if (document.category === "cv") {
    return application.employmentHistory.map(
      (experience) =>
        `${experience.employerName} | ${experience.title} | ${experience.currentRole ? "Current role" : "Past role"}`,
    );
  }

  return [
    `Source URI: ${document.sourceUri}`,
    `Checksum: ${document.checksumSha256}`,
  ];
}

export function buildAdmissionsDocumentPreview(
  record: AdmissionsQueueRecord,
  document: CanonicalDocumentReference,
  viewer: {
    actor: string;
    accessedAt: string;
  },
): string {
  const applicantName = `${record.application.personalDetails.firstName} ${record.application.personalDetails.lastName}`.trim();
  const evidenceSummary = buildDocumentEvidenceSummary(record.application, document)
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(document.filename)}</title>
    <style>
      body {
        font-family: Georgia, serif;
        margin: 0;
        background: #f5f2ea;
        color: #11243a;
      }
      main {
        max-width: 720px;
        margin: 0 auto;
        padding: 32px;
      }
      .badge {
        display: inline-block;
        border-radius: 999px;
        padding: 6px 12px;
        background: #0b4f74;
        color: white;
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .panel {
        margin-top: 24px;
        border-radius: 24px;
        background: white;
        padding: 24px;
        box-shadow: 0 16px 48px rgba(17, 36, 58, 0.08);
      }
      h1, h2 { margin: 0; }
      h1 { font-size: 28px; }
      h2 { font-size: 16px; text-transform: uppercase; letter-spacing: 0.1em; color: #5a6b7d; }
      p, li { line-height: 1.65; }
      ul { padding-left: 20px; }
      .meta { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
      .meta-item { border-radius: 18px; background: #f4f8fb; padding: 14px 16px; }
      .meta-label { display: block; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #5a6b7d; }
      .meta-value { display: block; margin-top: 6px; font-weight: 600; }
      .watermark {
        margin-top: 18px;
        border-radius: 18px;
        background: #fff3cd;
        color: #6b4b00;
        padding: 14px 16px;
        font-size: 12px;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }
    </style>
  </head>
  <body>
    <main>
      <span class="badge">Protected preview</span>
      <div class="panel">
        <h1>${escapeHtml(document.filename)}</h1>
        <p>${escapeHtml(applicantName)} | ${escapeHtml(record.application.selectedCourse.courseTitle)}</p>
        <div class="meta">
          <div class="meta-item">
            <span class="meta-label">Document type</span>
            <span class="meta-value">${escapeHtml(document.category)}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Uploaded</span>
            <span class="meta-value">${escapeHtml(document.uploadedAt)}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Content type</span>
            <span class="meta-value">${escapeHtml(document.contentType)}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Source system</span>
            <span class="meta-value">${escapeHtml(record.application.sourceSystem)}</span>
          </div>
        </div>
        <div class="watermark">
          Viewer ${escapeHtml(viewer.actor)} | Access logged ${escapeHtml(viewer.accessedAt)}
        </div>
      </div>
      <div class="panel">
        <h2>Evidence summary</h2>
        <p>This preview is rendered inside the protected admissions workspace and does not expose the raw storage URL.</p>
        <ul>${evidenceSummary}</ul>
      </div>
    </main>
  </body>
</html>`;
}
