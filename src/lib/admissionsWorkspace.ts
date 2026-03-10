import type {
  CanonicalApplicationV1,
  CanonicalDocumentReference,
} from "../integrationPlatform/contracts";
import { canonicalApplicationSamples } from "../integrationPlatform/examples";

export const ADMISSIONS_WORKSPACE_STORAGE_KEY =
  "application-prototype:admissions-workspace:v1";

export type AdmissionsQueueStatus =
  | "new"
  | "assigned"
  | "under-review"
  | "ready-for-decision";

export type AdmissionsPriority = "high" | "medium" | "normal";

export type AdmissionsAuditEventType = "assignment" | "status" | "note";

export interface AdmissionsNote {
  author: string;
  body: string;
  createdAt: string;
  noteId: string;
}

export interface AdmissionsAuditEvent {
  actor: string;
  eventId: string;
  occurredAt: string;
  summary: string;
  type: AdmissionsAuditEventType;
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

function createAuditEvent(input: {
  applicationId: string;
  actor: string;
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
      String(Date.parse(input.occurredAt)),
    ].join("-"),
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
  const seedConfigs: SeedConfig[] = [
    {
      lastActivityAt: "2026-03-10T09:05:00Z",
      priority: "high",
      status: "new",
    },
    {
      assignee: "samira.chen@keypath.com.au",
      assignedAt: "2026-03-10T09:20:00Z",
      assignedBy: "ops.lead@keypath.com.au",
      initialNote: {
        author: "samira.chen@keypath.com.au",
        body: "Flagged for language-evidence review before decisioning.",
        createdAt: "2026-03-10T09:24:00Z",
      },
      lastActivityAt: "2026-03-10T09:24:00Z",
      priority: "high",
      status: "assigned",
    },
    {
      assignee: "alex.wong@keypath.com.au",
      assignedAt: "2026-03-10T09:40:00Z",
      assignedBy: "ops.lead@keypath.com.au",
      initialNote: {
        author: "alex.wong@keypath.com.au",
        body: "Clinical placement evidence looks complete. Ready for final review.",
        createdAt: "2026-03-10T09:48:00Z",
      },
      lastActivityAt: "2026-03-10T09:48:00Z",
      priority: "medium",
      status: "under-review",
    },
  ];

  return canonicalApplicationSamples.map((application, index) =>
    createSeedRecord(application, seedConfigs[index] ?? seedConfigs[0]),
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
