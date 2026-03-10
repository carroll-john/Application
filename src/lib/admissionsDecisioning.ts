import {
  AuditedProvisioningService,
  InMemoryAuditLedgerStore,
  InMemoryExceptionQueueStore,
  type AuditLedgerEvent,
  type ExceptionQueueRecord,
  type ReconciliationResult,
} from "../integrationPlatform/operations";
import {
  createImportWorkflowAdapter,
} from "../integrationPlatform/adapterScaffolds";
import {
  universityExportMappingConfigSamples,
  universityMappingOverlaySamples,
} from "../integrationPlatform/examples";
import {
  generateStructuredExport,
  InMemoryStructuredExportArtifactStore,
  type StructuredExportArtifactReference,
} from "../integrationPlatform/exporters";
import {
  decisionRecordSchemaDefaults,
  InMemoryProvisioningJobStore,
  ProvisioningOrchestrator,
  type DecisionOutcomeStatus,
  type DecisionRecordV1,
  type ProvisioningJobStatus,
  type ProvisioningJobV1,
  type UniversityAdapter,
} from "../integrationPlatform/provisioning";
import {
  cloneAdmissionsRecords,
  type AdmissionsAuditEvent,
  type AdmissionsAuditEventType,
  type AdmissionsDecisionTrace,
  type AdmissionsQueueRecord,
  type AdmissionsQueueStatus,
} from "./admissionsWorkspace";
import {
  createSeedPartnerCourseRolloutConfigs,
  getPartnerCourseRolloutSnapshot,
  type PartnerCourseRolloutConfig,
  type PartnerCourseRolloutMode,
} from "./partnerCourseRollout";

export type AdmissionsDecisionOutcome =
  | "admit"
  | "conditional"
  | "waitlist"
  | "reject";

export interface AdmissionsDecisionReasonOption {
  description: string;
  label: string;
  outcome: AdmissionsDecisionOutcome;
  value: string;
}

export interface AdmissionsDecisionReadinessFlag {
  code:
    | "mode_allows_decision"
    | "status_ready"
    | "assignee_confirmed"
    | "evidence_available"
    | "provisioning_idle";
  detail: string;
  label: string;
  satisfied: boolean;
}

export interface AdmissionsDecisionReadiness {
  flags: AdmissionsDecisionReadinessFlag[];
  ready: boolean;
}

export interface CaptureAdmissionsDecisionInput {
  actor: string;
  applicationId: string;
  decidedAt?: string;
  notes?: string;
  outcome: AdmissionsDecisionOutcome;
  reasonCode: string;
  rolloutConfigs?: PartnerCourseRolloutConfig[];
}

export interface CaptureAdmissionsDecisionResult {
  decision: DecisionRecordV1;
  downstreamAction: "none" | "export" | "automated-provisioning";
  exception?: ExceptionQueueRecord;
  exportArtifact?: StructuredExportArtifactReference;
  readiness: AdmissionsDecisionReadiness;
  reconciliation?: ReconciliationResult;
  records: AdmissionsQueueRecord[];
  rolloutMode: PartnerCourseRolloutMode;
  triggeredProvisioning: boolean;
}

export const ADMISSIONS_DECISION_REASON_OPTIONS: AdmissionsDecisionReasonOption[] = [
  {
    outcome: "admit",
    value: "academic-qualified",
    label: "Academic qualified",
    description: "Applicant meets entry requirements and evidence is complete.",
  },
  {
    outcome: "admit",
    value: "competitive-profile",
    label: "Competitive profile",
    description: "Application meets quality threshold for immediate offer.",
  },
  {
    outcome: "conditional",
    value: "documents-pending",
    label: "Documents pending",
    description: "Offer can proceed once outstanding evidence is supplied.",
  },
  {
    outcome: "conditional",
    value: "identity-check",
    label: "Identity check",
    description: "Conditional offer pending final identity or compliance review.",
  },
  {
    outcome: "waitlist",
    value: "capacity-hold",
    label: "Capacity hold",
    description: "Application is viable but current intake capacity is constrained.",
  },
  {
    outcome: "waitlist",
    value: "ranked-reserve",
    label: "Ranked reserve",
    description: "Application remains in reserve pending stronger offer declines.",
  },
  {
    outcome: "reject",
    value: "academic-not-met",
    label: "Academic not met",
    description: "Academic entry requirements are not satisfied.",
  },
  {
    outcome: "reject",
    value: "english-not-met",
    label: "English not met",
    description: "English-language evidence does not meet the threshold.",
  },
];

function sanitizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function normalizeActor(actor: string): string {
  return actor.trim().toLowerCase();
}

function createAdmissionsAuditEvent(input: {
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
      sanitizeToken(input.summary),
    ].join("-"),
    occurredAt: input.occurredAt,
    summary: input.summary,
    type: input.type,
  };
}

function createPreparedPayload(
  mode: UniversityAdapter["mode"],
): UniversityAdapter["prepare"] {
  return ({ application, decision, job, overlay }) => ({
    envelopeId: `${job.jobId}-attempt-${job.attempts.length + 1}`,
    jobId: job.jobId,
    applicationId: application.applicationId,
    decisionId: decision.decisionId,
    adapterMode: mode,
    idempotencyKey: job.idempotencyKey,
    fieldCount: overlay.fieldMappings.length,
    documentCount: application.documents.length,
    executionMetadata: {
      routeKey: job.routingDecision.routeKey,
      partnerId: overlay.partnerId,
    },
  });
}

function createFileAdapter(): UniversityAdapter {
  return {
    mode: "file",
    routingProfile: {
      routeKey: "file:admissions-demo",
      priority: 10,
      supportedManifestFormats: ["json"],
      supportsInlineDocuments: false,
      supportedDuplicateCheckStrategies: ["source-application-id"],
    },
    prepare: createPreparedPayload("file"),
    execute: (_prepared, context) => ({
      accepted: true,
      externalReference: `file:${context.idempotencyKey}`,
      submittedAt: "2026-03-10T17:01:00Z",
    }),
    verify: (_prepared, execution) => ({
      verified: true,
      verifiedAt: "2026-03-10T17:02:00Z",
      externalReference: execution.externalReference,
    }),
    reconcile: () => ({
      status: "matched",
      reconciledAt: "2026-03-10T17:03:00Z",
      details: "Structured file delivery matched the downstream receipt.",
    }),
  };
}

function createPortalRpaAdapter(): UniversityAdapter {
  return {
    mode: "portal-rpa",
    routingProfile: {
      routeKey: "portal-rpa:admissions-demo",
      priority: 10,
      supportedManifestFormats: ["json"],
      supportsInlineDocuments: true,
      supportedDuplicateCheckStrategies: ["email-and-course"],
    },
    prepare: createPreparedPayload("portal-rpa"),
    execute: (_prepared, context) => ({
      accepted: true,
      externalReference: `portal:${context.idempotencyKey}`,
      submittedAt: "2026-03-10T17:01:00Z",
    }),
    verify: (_prepared, execution) => ({
      verified: true,
      verifiedAt: "2026-03-10T17:02:00Z",
      externalReference: execution.externalReference,
    }),
    reconcile: () => ({
      status: "matched",
      reconciledAt: "2026-03-10T17:03:00Z",
      details: "Portal automation verified the created target record.",
    }),
  };
}

function createAdmissionsProvisioningAdapters(): UniversityAdapter[] {
  return [
    createFileAdapter(),
    createImportWorkflowAdapter(),
    createPortalRpaAdapter(),
  ];
}

function getReferencedDocumentIds(record: AdmissionsQueueRecord): string[] {
  const ids = new Set<string>();

  record.application.qualifications.forEach((qualification) => {
    qualification.documentIds.forEach((documentId) => ids.add(documentId));
  });
  record.application.languageTests.forEach((test) => {
    test.documentIds.forEach((documentId) => ids.add(documentId));
  });
  record.application.documents
    .filter((document) => document.requiredForSubmission)
    .forEach((document) => ids.add(document.documentId));

  if (ids.size === 0) {
    record.application.documents.forEach((document) => ids.add(document.documentId));
  }

  return Array.from(ids);
}

function mapDecisionOutcomeStatus(
  outcome: AdmissionsDecisionOutcome,
): DecisionOutcomeStatus {
  switch (outcome) {
    case "admit":
      return "offer-made";
    case "conditional":
      return "conditional-offer";
    case "waitlist":
      return "waitlisted";
    case "reject":
      return "rejected";
  }
}

function shouldTriggerStructuredExport(
  outcome: AdmissionsDecisionOutcome,
  rolloutMode: PartnerCourseRolloutMode,
): boolean {
  return (
    (outcome === "admit" || outcome === "conditional") &&
    rolloutMode === "mode-2-decision-export"
  );
}

function shouldTriggerProvisioning(
  outcome: AdmissionsDecisionOutcome,
  rolloutMode: PartnerCourseRolloutMode,
): boolean {
  return (
    (outcome === "admit" || outcome === "conditional") &&
    rolloutMode === "mode-3-automated-provisioning"
  );
}

function upsertByKey<T>(
  items: T[],
  nextItem: T,
  getKey: (item: T) => string,
): T[] {
  const nextKey = getKey(nextItem);
  const remaining = items.filter((item) => getKey(item) !== nextKey);
  return [...remaining, nextItem];
}

function mergeProvisioningAuditEvents(
  current: AuditLedgerEvent[],
  next: AuditLedgerEvent[],
): AuditLedgerEvent[] {
  const merged = new Map<string, AuditLedgerEvent>();

  [...current, ...next].forEach((event) => {
    merged.set(event.eventId, {
      ...event,
      metadata: event.metadata ? { ...event.metadata } : undefined,
    });
  });

  return Array.from(merged.values()).sort((left, right) =>
    left.occurredAt.localeCompare(right.occurredAt),
  );
}

function findAdmissionsOverlay(record: AdmissionsQueueRecord) {
  const partnerId = record.application.selectedCourse.providerCode;
  return universityMappingOverlaySamples.find((overlay) => overlay.partnerId === partnerId);
}

function findAdmissionsExportTemplate(record: AdmissionsQueueRecord) {
  const partnerId = record.application.selectedCourse.providerCode;
  return universityExportMappingConfigSamples.find(
    (template) => template.partnerId === partnerId,
  );
}

function createAdmissionsExportArtifactStore(record: AdmissionsQueueRecord) {
  const artifactStore = new InMemoryStructuredExportArtifactStore();
  record.decisionTrace.exports.forEach((reference) => artifactStore.save(reference));
  return artifactStore;
}

function toStructuredExportArtifactReference(input: {
  applicationId: string;
  decisionId: string;
  generatedExport: Awaited<ReturnType<typeof generateStructuredExport>>;
  partnerId: string;
}): StructuredExportArtifactReference {
  return {
    applicationId: input.applicationId,
    artifact: {
      ...input.generatedExport.artifact,
    },
    content: input.generatedExport.content,
    decisionId: input.decisionId,
    filename: input.generatedExport.filename,
    idempotencyKey: input.generatedExport.idempotencyKey,
    manifest: {
      ...input.generatedExport.manifest,
      artifacts: input.generatedExport.manifest.artifacts.map((artifact) => ({
        ...artifact,
      })),
      documents: input.generatedExport.manifest.documents.map((document) => ({
        ...document,
      })),
      handoff: {
        ...input.generatedExport.manifest.handoff,
      },
      metadata: input.generatedExport.manifest.metadata
        ? { ...input.generatedExport.manifest.metadata }
        : undefined,
    },
    partnerId: input.partnerId,
    traceability: {
      ...input.generatedExport.traceability,
    },
  };
}

export function getAdmissionsDecisionReasonOptions(
  outcome: AdmissionsDecisionOutcome,
): AdmissionsDecisionReasonOption[] {
  return ADMISSIONS_DECISION_REASON_OPTIONS.filter(
    (option) => option.outcome === outcome,
  );
}

export function getAdmissionsDecisionReasonLabel(reasonCode: string): string {
  const option = ADMISSIONS_DECISION_REASON_OPTIONS.find(
    (candidate) => candidate.value === reasonCode,
  );
  return option?.label ?? reasonCode;
}

export function formatAdmissionsDecisionOutcome(
  outcome: AdmissionsDecisionOutcome | DecisionOutcomeStatus,
): string {
  switch (outcome) {
    case "admit":
    case "offer-made":
      return "Admit";
    case "conditional":
    case "conditional-offer":
      return "Conditional";
    case "waitlist":
    case "waitlisted":
      return "Waitlist";
    case "reject":
    case "rejected":
      return "Reject";
  }
}

export function getLatestAdmissionsDecision(
  record: AdmissionsQueueRecord,
): DecisionRecordV1 | undefined {
  return [...record.decisionTrace.decisions].sort((left, right) =>
    left.decidedAt.localeCompare(right.decidedAt),
  ).at(-1);
}

export function getLatestAdmissionsProvisioningJob(
  record: AdmissionsQueueRecord,
): ProvisioningJobV1 | undefined {
  return [...record.decisionTrace.provisioningJobs].sort((left, right) =>
    left.updatedAt.localeCompare(right.updatedAt),
  ).at(-1);
}

export function getLatestAdmissionsStructuredExport(
  record: AdmissionsQueueRecord,
): StructuredExportArtifactReference | undefined {
  return [...record.decisionTrace.exports].sort((left, right) =>
    left.manifest.generatedAt.localeCompare(right.manifest.generatedAt),
  ).at(-1);
}

export function listAdmissionsProvisioningAuditEvents(
  record: AdmissionsQueueRecord,
  jobId?: string,
): AuditLedgerEvent[] {
  return [...record.decisionTrace.auditEvents]
    .filter((event) => (jobId ? event.jobId === jobId : true))
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
}

export function getLatestAdmissionsReconciliation(
  record: AdmissionsQueueRecord,
  jobId?: string,
): ReconciliationResult | undefined {
  return [...record.decisionTrace.reconciliations]
    .filter((item) => (jobId ? item.jobId === jobId : true))
    .sort((left, right) => left.checkedAt.localeCompare(right.checkedAt))
    .at(-1);
}

export function getOpenAdmissionsException(
  record: AdmissionsQueueRecord,
  jobId?: string,
): ExceptionQueueRecord | undefined {
  return [...record.decisionTrace.exceptions]
    .filter((item) => item.status === "open")
    .filter((item) => (jobId ? item.jobId === jobId : true))
    .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt))
    .at(-1);
}

export function evaluateAdmissionsDecisionReadiness(
  record: AdmissionsQueueRecord,
  actor: string,
  rolloutConfigs = createSeedPartnerCourseRolloutConfigs(),
): AdmissionsDecisionReadiness {
  const normalizedActor = normalizeActor(actor);
  const documentIds = getReferencedDocumentIds(record);
  const availableDocuments = new Set(
    record.application.documents.map((document) => document.documentId),
  );
  const rolloutSnapshot = getPartnerCourseRolloutSnapshot(
    record.application,
    rolloutConfigs,
  );
  const latestJob = getLatestAdmissionsProvisioningJob(record);
  const hasActiveProvisioning = latestJob
    ? (["pending", "in_progress", "retry_pending"] as ProvisioningJobStatus[]).includes(
        latestJob.status,
      )
    : false;
  const flags: AdmissionsDecisionReadinessFlag[] = [
    {
      code: "mode_allows_decision",
      label: "Rollout mode allows decision capture",
      detail: rolloutSnapshot.definition.decisionCaptureEnabled
        ? `${rolloutSnapshot.definition.label} is active for this partner course line.`
        : rolloutSnapshot.isFallback
          ? "No rollout config is assigned for this partner course line, so the portal defaults to Mode 1 review-only."
          : `${rolloutSnapshot.definition.label} is active. Decision capture is blocked until this course line moves to Mode 2 or Mode 3.`,
      satisfied: rolloutSnapshot.definition.decisionCaptureEnabled,
    },
    {
      code: "status_ready",
      label: "Queue status is ready for decision",
      detail:
        record.status === "ready-for-decision"
          ? "Reviewer workflow has reached the decision-ready checkpoint."
          : `Current queue status is ${record.status}. Move the record to ready for decision before capturing an outcome.`,
      satisfied: record.status === "ready-for-decision",
    },
    {
      code: "assignee_confirmed",
      label: "Application is assigned to the active reviewer",
      detail: !normalizedActor
        ? "A signed-in reviewer is required before capturing a decision."
        : normalizeActor(record.assignee ?? "") === normalizedActor
          ? "Assignment matches the active reviewer."
          : record.assignee
            ? `Application is assigned to ${record.assignee}. Reassign it before deciding.`
            : "Assign this application to yourself before capturing a decision.",
      satisfied: Boolean(
        normalizedActor &&
          record.assignee &&
          normalizeActor(record.assignee) === normalizedActor,
      ),
    },
    {
      code: "evidence_available",
      label: "Required review evidence is attached",
      detail:
        documentIds.length === 0
          ? "No structured evidence references were found for this application."
          : documentIds.every((documentId) => availableDocuments.has(documentId))
            ? `Structured review evidence is available across ${documentIds.length} referenced document(s).`
            : "One or more structured evidence references are missing from the admissions document set.",
      satisfied:
        documentIds.length > 0 &&
        documentIds.every((documentId) => availableDocuments.has(documentId)),
    },
    {
      code: "provisioning_idle",
      label: "No active provisioning run is already open",
      detail: hasActiveProvisioning
        ? `Latest provisioning job is still ${latestJob?.status}. Wait for it to settle before capturing another approved decision.`
        : "No in-flight provisioning run is blocking decision capture.",
      satisfied: !hasActiveProvisioning,
    },
  ];

  return {
    flags,
    ready: flags.every((flag) => flag.satisfied),
  };
}

function buildDecisionRecord(input: {
  actor: string;
  outcome: AdmissionsDecisionOutcome;
  reasonCode: string;
  notes?: string;
  occurredAt: string;
  record: AdmissionsQueueRecord;
  rolloutMode: PartnerCourseRolloutMode;
  downstreamAction: "none" | "export" | "automated-provisioning";
}): DecisionRecordV1 {
  const application = input.record.application;
  return {
    ...decisionRecordSchemaDefaults,
    decisionId: [
      "decision",
      sanitizeToken(application.applicationId),
      String(Date.parse(input.occurredAt)),
    ].join("-"),
    applicationId: application.applicationId,
    applicantId: application.applicantId,
    partnerId: application.selectedCourse.providerCode,
    partnerName: application.selectedCourse.providerName,
    decidedAt: input.occurredAt,
    decidedBy: input.actor,
    correlationId: [
      "corr",
      sanitizeToken(application.applicationId),
      String(Date.parse(input.occurredAt)),
    ].join("-"),
    outcome: {
      status: mapDecisionOutcomeStatus(input.outcome),
      reasonCode: input.reasonCode,
      notes: input.notes?.trim() || undefined,
    },
    metadata: {
      admissionsQueueStatus: input.record.status,
      applicationStatusAtDecision: application.status,
      downstreamAction: input.downstreamAction,
      rolloutMode: input.rolloutMode,
      selectedCourseCode: application.selectedCourse.courseCode,
    },
  };
}

function derivePostDecisionQueueStatus(input: {
  outcome: AdmissionsDecisionOutcome;
  rolloutMode: PartnerCourseRolloutMode;
  provisioningJob?: ProvisioningJobV1;
}): AdmissionsQueueStatus {
  if (!shouldTriggerProvisioning(input.outcome, input.rolloutMode)) {
    return "decisioned";
  }

  switch (input.provisioningJob?.status) {
    case "completed":
      return "provisioned";
    case "failed":
      return "provisioning-exception";
    default:
      return "provisioning";
  }
}

export async function captureAdmissionsDecision(
  records: AdmissionsQueueRecord[],
  input: CaptureAdmissionsDecisionInput,
): Promise<CaptureAdmissionsDecisionResult> {
  const nextRecords = cloneAdmissionsRecords(records);
  const record = nextRecords.find(
    (candidate) => candidate.applicationId === input.applicationId,
  );

  if (!record) {
    throw new Error("Admissions record not found.");
  }

  const rolloutConfigs = input.rolloutConfigs ?? createSeedPartnerCourseRolloutConfigs();
  const rolloutSnapshot = getPartnerCourseRolloutSnapshot(
    record.application,
    rolloutConfigs,
  );
  const triggeredExport = shouldTriggerStructuredExport(
    input.outcome,
    rolloutSnapshot.mode,
  );
  const triggeredProvisioning = shouldTriggerProvisioning(
    input.outcome,
    rolloutSnapshot.mode,
  );
  const downstreamAction = triggeredProvisioning
    ? "automated-provisioning"
    : triggeredExport
      ? "export"
      : "none";
  const readiness = evaluateAdmissionsDecisionReadiness(
    record,
    input.actor,
    rolloutConfigs,
  );
  if (!readiness.ready) {
    throw new Error(
      readiness.flags
        .filter((flag) => !flag.satisfied)
        .map((flag) => flag.detail)
        .join(" "),
    );
  }

  if (!input.reasonCode.trim()) {
    throw new Error("A decision reason code is required.");
  }

  const occurredAt = input.decidedAt ?? new Date().toISOString();
  const decision = buildDecisionRecord({
    actor: input.actor,
    downstreamAction,
    outcome: input.outcome,
    reasonCode: input.reasonCode,
    notes: input.notes,
    occurredAt,
    record,
    rolloutMode: rolloutSnapshot.mode,
  });
  let exportArtifact: StructuredExportArtifactReference | undefined;
  let provisioningJob: ProvisioningJobV1 | undefined;
  let reconciliation: ReconciliationResult | undefined;
  let exception: ExceptionQueueRecord | undefined;

  if (triggeredExport) {
    const template = findAdmissionsExportTemplate(record);
    if (!template) {
      throw new Error("No structured export template is registered for this partner.");
    }

    const generatedExport = await generateStructuredExport({
      application: record.application,
      artifactStore: createAdmissionsExportArtifactStore(record),
      decision,
      generatedAt: occurredAt,
      template,
    });
    exportArtifact = toStructuredExportArtifactReference({
      applicationId: record.application.applicationId,
      decisionId: decision.decisionId,
      generatedExport,
      partnerId: record.application.selectedCourse.providerCode,
    });
    record.decisionTrace.exports = upsertByKey(
      record.decisionTrace.exports,
      exportArtifact,
      (reference) => reference.idempotencyKey,
    );
  }

  if (triggeredProvisioning) {
    const overlay = findAdmissionsOverlay(record);
    if (!overlay) {
      throw new Error("No mapping overlay is registered for this partner.");
    }

    const jobStore = new InMemoryProvisioningJobStore();
    record.decisionTrace.provisioningJobs.forEach((job) => jobStore.save(job));

    const auditLedger = new InMemoryAuditLedgerStore();
    record.decisionTrace.auditEvents.forEach((event) => auditLedger.append(event));

    const exceptionQueue = new InMemoryExceptionQueueStore();
    record.decisionTrace.exceptions.forEach((item) => exceptionQueue.save(item));

    const service = new AuditedProvisioningService({
      orchestrator: new ProvisioningOrchestrator({
        adapters: createAdmissionsProvisioningAdapters(),
        jobStore,
        now: () => occurredAt,
      }),
      jobStore,
      auditLedger,
      exceptionQueue,
      now: () => occurredAt,
    });
    const outcome = await service.processDecision({
      application: record.application,
      decision,
      overlay,
    });

    provisioningJob = outcome.result.job;
    reconciliation = outcome.reconciliation;
    exception = outcome.exception;
    record.decisionTrace.provisioningJobs = upsertByKey(
      record.decisionTrace.provisioningJobs,
      provisioningJob,
      (job) => job.jobId,
    );
    record.decisionTrace.auditEvents = mergeProvisioningAuditEvents(
      record.decisionTrace.auditEvents,
      outcome.auditEvents,
    );
    record.decisionTrace.reconciliations = upsertByKey(
      record.decisionTrace.reconciliations,
      reconciliation,
      (item) => item.jobId,
    );
    if (exception) {
      record.decisionTrace.exceptions = upsertByKey(
        record.decisionTrace.exceptions,
        exception,
        (item) => item.exceptionId,
      );
    }
  }

  record.application.status = "decisioned";
  record.decisionTrace.decisions = [...record.decisionTrace.decisions, decision];
  record.lastActivityAt = occurredAt;
  record.status = derivePostDecisionQueueStatus({
    outcome: input.outcome,
    rolloutMode: rolloutSnapshot.mode,
    provisioningJob,
  });
  record.auditEvents = [
    ...record.auditEvents,
    createAdmissionsAuditEvent({
      applicationId: record.applicationId,
      actor: input.actor,
      occurredAt,
      summary: `Decision captured: ${formatAdmissionsDecisionOutcome(input.outcome)} (${getAdmissionsDecisionReasonLabel(input.reasonCode)}).`,
      type: "decision",
    }),
    createAdmissionsAuditEvent({
      applicationId: record.applicationId,
      actor: input.actor,
      occurredAt,
      summary: `Queue status changed to ${record.status}.`,
      type: "status",
    }),
  ];

  if (exportArtifact) {
    record.auditEvents.push(
      createAdmissionsAuditEvent({
        applicationId: record.applicationId,
        actor: input.actor,
        occurredAt,
        summary: `Structured export handoff prepared: ${exportArtifact.filename}.`,
        type: "export",
      }),
    );
  }

  if (provisioningJob) {
    record.auditEvents.push(
      createAdmissionsAuditEvent({
        applicationId: record.applicationId,
        actor: input.actor,
        occurredAt,
        summary: `Provisioning trigger completed on ${provisioningJob.adapterMode} and is now ${provisioningJob.status}.`,
        type: "provisioning",
      }),
    );
  }

  return {
    decision,
    downstreamAction,
    exception,
    exportArtifact,
    readiness,
    reconciliation,
    records: nextRecords,
    rolloutMode: rolloutSnapshot.mode,
    triggeredProvisioning,
  };
}
