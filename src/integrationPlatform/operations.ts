import type {
  CanonicalApplicationV1,
  UniversityMappingOverlayV1,
} from "./contracts";
import {
  type ProvisioningJobStatus,
  createProvisioningIdempotencyKey,
  type DecisionRecordV1,
  type OrchestrationResult,
  type ProvisioningJobStore,
  type ProvisioningJobV1,
  type ProvisioningOrchestrator,
} from "./provisioning";

export type AuditEventType =
  | "job.created"
  | "job.attempt.recorded"
  | "job.completed"
  | "job.retry_pending"
  | "job.failed"
  | "job.reconciled"
  | "exception.queued"
  | "exception.triaged"
  | "exception.replay_blocked"
  | "exception.replayed";

export interface AuditLedgerEvent {
  eventId: string;
  occurredAt: string;
  correlationId: string;
  jobId: string;
  decisionId: string;
  type: AuditEventType;
  summary: string;
  metadata?: Record<string, string>;
}

export interface AuditLedgerStore {
  append(event: AuditLedgerEvent): void;
  listByJobId(jobId: string): AuditLedgerEvent[];
}

function cloneAuditEvent(event: AuditLedgerEvent): AuditLedgerEvent {
  return {
    ...event,
    metadata: event.metadata ? { ...event.metadata } : undefined,
  };
}

export class InMemoryAuditLedgerStore implements AuditLedgerStore {
  private readonly events: AuditLedgerEvent[] = [];

  append(event: AuditLedgerEvent): void {
    this.events.push(cloneAuditEvent(event));
  }

  listByJobId(jobId: string): AuditLedgerEvent[] {
    return this.events
      .filter((event) => event.jobId === jobId)
      .map((event) => cloneAuditEvent(event));
  }
}

export type ReconciliationStatus =
  | "matched"
  | "missing_target_record"
  | "partial_delivery"
  | "invalid_target_record"
  | "job_not_terminal";

export type ReconciliationEscalationState =
  | "none"
  | "monitor"
  | "queue_exception";

export type DownstreamReceiptStatus = "received" | "partial" | "invalid";

export interface DownstreamReceiptRecord {
  jobId: string;
  correlationId: string;
  observedAt: string;
  status: DownstreamReceiptStatus;
  externalReference?: string;
  details?: string;
}

export interface DownstreamReceiptStore {
  getByJobId(jobId: string): DownstreamReceiptRecord | undefined;
  save(receipt: DownstreamReceiptRecord): void;
}

function cloneDownstreamReceipt(
  receipt: DownstreamReceiptRecord,
): DownstreamReceiptRecord {
  return {
    ...receipt,
  };
}

export class InMemoryDownstreamReceiptStore implements DownstreamReceiptStore {
  private readonly receipts = new Map<string, DownstreamReceiptRecord>();

  getByJobId(jobId: string): DownstreamReceiptRecord | undefined {
    const receipt = this.receipts.get(jobId);
    return receipt ? cloneDownstreamReceipt(receipt) : undefined;
  }

  save(receipt: DownstreamReceiptRecord): void {
    this.receipts.set(receipt.jobId, cloneDownstreamReceipt(receipt));
  }
}

export interface ReconciliationResult {
  jobId: string;
  correlationId: string;
  status: ReconciliationStatus;
  checkedAt: string;
  details: string;
  escalationState: ReconciliationEscalationState;
  expectedTargetRecordRef?: string;
  receivedTargetRecordRef?: string;
  receiptStatus?: DownstreamReceiptStatus;
}

export interface RecordedReconciliationResult extends ReconciliationResult {
  resultId: string;
  runId: string;
  decisionId: string;
  partnerId: string;
  partnerName: string;
  adapterMode: ProvisioningJobV1["adapterMode"];
  jobStatus: ProvisioningJobStatus;
}

export interface ReconciliationResultFilters {
  partnerId?: string;
  adapterMode?: ProvisioningJobV1["adapterMode"];
  status?: ReconciliationStatus;
  escalationState?: ReconciliationEscalationState;
}

export interface ReconciliationResultStore {
  getLatestByJobId(jobId: string): RecordedReconciliationResult | undefined;
  listLatest(filters?: ReconciliationResultFilters): RecordedReconciliationResult[];
  save(result: RecordedReconciliationResult): void;
}

function cloneRecordedReconciliationResult(
  result: RecordedReconciliationResult,
): RecordedReconciliationResult {
  return {
    ...result,
  };
}

export class InMemoryReconciliationResultStore
  implements ReconciliationResultStore
{
  private readonly latestByJobId = new Map<string, RecordedReconciliationResult>();

  getLatestByJobId(jobId: string): RecordedReconciliationResult | undefined {
    const result = this.latestByJobId.get(jobId);
    return result ? cloneRecordedReconciliationResult(result) : undefined;
  }

  listLatest(
    filters: ReconciliationResultFilters = {},
  ): RecordedReconciliationResult[] {
    return Array.from(this.latestByJobId.values())
      .filter((result) =>
        filters.partnerId ? result.partnerId === filters.partnerId : true,
      )
      .filter((result) =>
        filters.adapterMode ? result.adapterMode === filters.adapterMode : true,
      )
      .filter((result) =>
        filters.status ? result.status === filters.status : true,
      )
      .filter((result) =>
        filters.escalationState
          ? result.escalationState === filters.escalationState
          : true,
      )
      .sort((left, right) => right.checkedAt.localeCompare(left.checkedAt))
      .map((result) => cloneRecordedReconciliationResult(result));
  }

  save(result: RecordedReconciliationResult): void {
    this.latestByJobId.set(result.jobId, cloneRecordedReconciliationResult(result));
  }
}

export type ExceptionQueueStatus = "open" | "replayed" | "resolved";

export type ExceptionQueueActionType =
  | "note_added"
  | "resolved"
  | "replayed";

export interface ExceptionQueueTriageAction {
  actionId: string;
  actionType: ExceptionQueueActionType;
  actor: string;
  actedAt: string;
  note?: string;
}

export interface ExceptionQueueRecord {
  exceptionId: string;
  jobId: string;
  decisionId: string;
  correlationId: string;
  partnerId: string;
  partnerName: string;
  adapterMode: ProvisioningJobV1["adapterMode"];
  jobStatus: ProvisioningJobStatus;
  reasonCode: ReconciliationStatus;
  summary: string;
  escalationState: ReconciliationEscalationState;
  status: ExceptionQueueStatus;
  createdAt: string;
  updatedAt: string;
  notes: string[];
  triageActions: ExceptionQueueTriageAction[];
  lastReplayAt?: string;
}

export interface ExceptionQueueFilters {
  status?: ExceptionQueueStatus;
  partnerId?: string;
  adapterMode?: ProvisioningJobV1["adapterMode"];
  reasonCode?: ReconciliationStatus;
}

export interface ExceptionQueueStore {
  getById(exceptionId: string): ExceptionQueueRecord | undefined;
  getOpenByJobId(jobId: string): ExceptionQueueRecord | undefined;
  list(filters?: ExceptionQueueFilters): ExceptionQueueRecord[];
  save(record: ExceptionQueueRecord): void;
}

function cloneTriageAction(
  action: ExceptionQueueTriageAction,
): ExceptionQueueTriageAction {
  return {
    ...action,
  };
}

function cloneExceptionRecord(record: ExceptionQueueRecord): ExceptionQueueRecord {
  return {
    ...record,
    notes: [...record.notes],
    triageActions: record.triageActions.map((action) => cloneTriageAction(action)),
  };
}

export class InMemoryExceptionQueueStore implements ExceptionQueueStore {
  private readonly exceptions = new Map<string, ExceptionQueueRecord>();

  getById(exceptionId: string): ExceptionQueueRecord | undefined {
    const record = this.exceptions.get(exceptionId);
    return record ? cloneExceptionRecord(record) : undefined;
  }

  getOpenByJobId(jobId: string): ExceptionQueueRecord | undefined {
    for (const record of this.exceptions.values()) {
      if (record.jobId === jobId && record.status === "open") {
        return cloneExceptionRecord(record);
      }
    }

    return undefined;
  }

  list(filters: ExceptionQueueFilters = {}): ExceptionQueueRecord[] {
    return Array.from(this.exceptions.values())
      .filter((record) =>
        filters.status ? record.status === filters.status : true,
      )
      .filter((record) =>
        filters.partnerId ? record.partnerId === filters.partnerId : true,
      )
      .filter((record) =>
        filters.adapterMode ? record.adapterMode === filters.adapterMode : true,
      )
      .filter((record) =>
        filters.reasonCode ? record.reasonCode === filters.reasonCode : true,
      )
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((record) => cloneExceptionRecord(record));
  }

  save(record: ExceptionQueueRecord): void {
    this.exceptions.set(record.exceptionId, cloneExceptionRecord(record));
  }
}

function createExceptionActionId(
  exceptionId: string,
  sequence: number,
): string {
  return [
    "triage",
    sanitizeToken(exceptionId),
    String(sequence).padStart(3, "0"),
  ].join("-");
}

function shouldQueueException(
  reconciliation: ReconciliationResult,
): boolean {
  return reconciliation.escalationState === "queue_exception";
}

function buildExceptionRecord(input: {
  existing?: ExceptionQueueRecord;
  job: ProvisioningJobV1;
  reconciliation: ReconciliationResult;
  timestamp: string;
}): ExceptionQueueRecord {
  const { existing, job, reconciliation, timestamp } = input;

  if (existing) {
    return {
      ...existing,
      jobStatus: job.status,
      reasonCode: reconciliation.status,
      summary: reconciliation.details,
      escalationState: reconciliation.escalationState,
      updatedAt: timestamp,
    };
  }

  return {
    exceptionId: `exception-${sanitizeToken(job.jobId)}`,
    jobId: job.jobId,
    decisionId: job.decisionId,
    correlationId: job.correlationId,
    partnerId: job.partnerId,
    partnerName: job.partnerName,
    adapterMode: job.adapterMode,
    jobStatus: job.status,
    reasonCode: reconciliation.status,
    summary: reconciliation.details,
    escalationState: reconciliation.escalationState,
    status: "open",
    createdAt: timestamp,
    updatedAt: timestamp,
    notes: [],
    triageActions: [],
  };
}

export interface AuditedProvisioningServiceOptions {
  orchestrator: ProvisioningOrchestrator;
  jobStore: ProvisioningJobStore;
  auditLedger: AuditLedgerStore;
  exceptionQueue: ExceptionQueueStore;
  receiptStore?: DownstreamReceiptStore;
  now?: () => string;
}

export interface AuditedProvisioningOutcome {
  result: OrchestrationResult;
  auditEvents: AuditLedgerEvent[];
  reconciliation: ReconciliationResult;
  exception?: ExceptionQueueRecord;
}

export type ReplayCheckpoint = "execute" | "reconcile";

export interface ReplayCheckpointEvaluation {
  eligible: boolean;
  checkpoint?: ReplayCheckpoint;
  reason: string;
  unsafeReasons: string[];
}

function sanitizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function cloneJob(job: ProvisioningJobV1): ProvisioningJobV1 {
  return {
    ...job,
    attempts: job.attempts.map((attempt) => ({ ...attempt })),
    transitionHistory: job.transitionHistory.map((transition) => ({
      ...transition,
      metadata: transition.metadata ? { ...transition.metadata } : undefined,
    })),
  };
}

function createRecordedReconciliationResult(input: {
  job: ProvisioningJobV1;
  reconciliation: ReconciliationResult;
  runId: string;
  sequence: number;
}): RecordedReconciliationResult {
  return {
    resultId: [
      "reconciliation",
      sanitizeToken(input.job.jobId),
      String(input.sequence).padStart(3, "0"),
    ].join("-"),
    runId: input.runId,
    decisionId: input.job.decisionId,
    partnerId: input.job.partnerId,
    partnerName: input.job.partnerName,
    adapterMode: input.job.adapterMode,
    jobStatus: input.job.status,
    ...input.reconciliation,
  };
}

function createTriageAction(input: {
  exceptionId: string;
  sequence: number;
  actionType: ExceptionQueueActionType;
  actor: string;
  actedAt: string;
  note?: string;
}): ExceptionQueueTriageAction {
  return {
    actionId: createExceptionActionId(input.exceptionId, input.sequence),
    actionType: input.actionType,
    actor: input.actor,
    actedAt: input.actedAt,
    note: input.note,
  };
}

function classifyReconciliation(input: {
  job: ProvisioningJobV1;
  checkedAt: string;
  receipt?: DownstreamReceiptRecord;
  requireReceiptEvidence: boolean;
}): ReconciliationResult {
  const { job, checkedAt, receipt, requireReceiptEvidence } = input;
  const expectedTargetRecordRef = job.targetRecordRef;

  if (job.status === "pending" || job.status === "in_progress") {
    return {
      jobId: job.jobId,
      correlationId: job.correlationId,
      status: "job_not_terminal",
      checkedAt,
      details: "Provisioning job is still pending or in progress.",
      escalationState: "none",
      expectedTargetRecordRef,
      receivedTargetRecordRef: receipt?.externalReference,
      receiptStatus: receipt?.status,
    };
  }

  if (receipt) {
    if (receipt.status === "invalid") {
      return {
        jobId: job.jobId,
        correlationId: job.correlationId,
        status: "invalid_target_record",
        checkedAt,
        details:
          receipt.details ??
          "Downstream receipt was present but marked invalid by the destination.",
        escalationState: "queue_exception",
        expectedTargetRecordRef,
        receivedTargetRecordRef: receipt.externalReference,
        receiptStatus: receipt.status,
      };
    }

    if (
      expectedTargetRecordRef &&
      receipt.externalReference &&
      receipt.externalReference !== expectedTargetRecordRef
    ) {
      return {
        jobId: job.jobId,
        correlationId: job.correlationId,
        status: "invalid_target_record",
        checkedAt,
        details:
          `Downstream receipt ${receipt.externalReference} did not match expected target ${expectedTargetRecordRef}.`,
        escalationState: "queue_exception",
        expectedTargetRecordRef,
        receivedTargetRecordRef: receipt.externalReference,
        receiptStatus: receipt.status,
      };
    }

    if (receipt.status === "partial") {
      return {
        jobId: job.jobId,
        correlationId: job.correlationId,
        status: "partial_delivery",
        checkedAt,
        details:
          receipt.details ??
          "Downstream receipt indicates a partial provisioning outcome.",
        escalationState: "queue_exception",
        expectedTargetRecordRef,
        receivedTargetRecordRef: receipt.externalReference,
        receiptStatus: receipt.status,
      };
    }

    if (receipt.status === "received") {
      return {
        jobId: job.jobId,
        correlationId: job.correlationId,
        status: "matched",
        checkedAt,
        details: `Matched downstream record ${receipt.externalReference ?? expectedTargetRecordRef ?? "unknown"}.`,
        escalationState: "none",
        expectedTargetRecordRef,
        receivedTargetRecordRef: receipt.externalReference,
        receiptStatus: receipt.status,
      };
    }

    return {
      jobId: job.jobId,
      correlationId: job.correlationId,
      status: "partial_delivery",
      checkedAt,
      details:
        receipt.details ??
        "Downstream receipt exists but the provisioning job did not complete cleanly.",
      escalationState: "queue_exception",
      expectedTargetRecordRef,
      receivedTargetRecordRef: receipt.externalReference,
      receiptStatus: receipt.status,
    };
  }

  if (requireReceiptEvidence) {
    if (job.status === "completed") {
      return {
        jobId: job.jobId,
        correlationId: job.correlationId,
        status: expectedTargetRecordRef ? "missing_target_record" : "partial_delivery",
        checkedAt,
        details: expectedTargetRecordRef
          ? "No downstream receipt was found for the completed provisioning job."
          : "Provisioning completed without a downstream target reference or receipt.",
        escalationState: "queue_exception",
        expectedTargetRecordRef,
      };
    }

    if (job.status === "failed" || job.status === "retry_pending") {
      return {
        jobId: job.jobId,
        correlationId: job.correlationId,
        status: expectedTargetRecordRef ? "partial_delivery" : "missing_target_record",
        checkedAt,
        details: expectedTargetRecordRef
          ? "Provisioning has a partial downstream footprint but no confirming receipt."
          : "No downstream receipt was found for the failed provisioning job.",
        escalationState: "queue_exception",
        expectedTargetRecordRef,
      };
    }
  }

  if (job.status === "completed" && expectedTargetRecordRef) {
    return {
      jobId: job.jobId,
      correlationId: job.correlationId,
      status: "matched",
      checkedAt,
      details: `Matched downstream record ${expectedTargetRecordRef}.`,
      escalationState: "none",
      expectedTargetRecordRef,
    };
  }

  if (job.status === "completed" && !expectedTargetRecordRef) {
    return {
      jobId: job.jobId,
      correlationId: job.correlationId,
      status: "partial_delivery",
      checkedAt,
      details: "Provisioning completed without a downstream target reference.",
      escalationState: "queue_exception",
    };
  }

  return {
    jobId: job.jobId,
    correlationId: job.correlationId,
    status: expectedTargetRecordRef ? "partial_delivery" : "missing_target_record",
    checkedAt,
    details: expectedTargetRecordRef
      ? "Provisioning has a partial downstream footprint but did not complete cleanly."
      : "No downstream target record could be verified for this job.",
    escalationState: "queue_exception",
    expectedTargetRecordRef,
  };
}

function evaluateReplayCheckpoint(input: {
  job?: ProvisioningJobV1;
  exception?: ExceptionQueueRecord;
  receipt?: DownstreamReceiptRecord;
}): ReplayCheckpointEvaluation {
  if (!input.exception) {
    return {
      eligible: false,
      reason: "Exception record was not found.",
      unsafeReasons: ["missing_exception_record"],
    };
  }

  if (input.exception.status !== "open") {
    return {
      eligible: false,
      reason: "Exception record is not open for replay.",
      unsafeReasons: ["exception_not_open"],
    };
  }

  if (!input.job) {
    return {
      eligible: false,
      reason: "Provisioning job was not found for the exception.",
      unsafeReasons: ["missing_job_record"],
    };
  }

  if (input.job.status === "pending" || input.job.status === "in_progress") {
    return {
      eligible: false,
      reason: "Provisioning job is still active and cannot be replayed from a checkpoint.",
      unsafeReasons: ["job_not_terminal"],
    };
  }

  const remainingAttempts = input.job.maxAttempts - input.job.attempts.length;
  const hasDownstreamFootprint = Boolean(
    input.job.targetRecordRef || input.receipt?.externalReference,
  );

  if (hasDownstreamFootprint) {
    if (!input.receipt) {
      return {
        eligible: false,
        reason:
          "Replay from reconcile checkpoint is blocked until a downstream receipt is available.",
        unsafeReasons: ["missing_downstream_receipt"],
      };
    }

    return {
      eligible: true,
      checkpoint: "reconcile",
      reason:
        "A downstream footprint already exists, so reconcile is the safe replay checkpoint.",
      unsafeReasons: ["execute_would_risk_duplicate_side_effects"],
    };
  }

  if (input.job.status === "retry_pending" && remainingAttempts > 0) {
    return {
      eligible: true,
      checkpoint: "execute",
      reason:
        "The job is retry-pending with remaining attempt budget, so execute is the safe replay checkpoint.",
      unsafeReasons: [],
    };
  }

  if (input.job.status === "failed") {
    return {
      eligible: false,
      reason:
        remainingAttempts <= 0
          ? "Replay from execute checkpoint is blocked because the retry budget is exhausted."
          : "Replay from execute checkpoint is blocked because the failure was terminal.",
      unsafeReasons:
        remainingAttempts <= 0
          ? ["retry_budget_exhausted"]
          : ["terminal_failure_requires_manual_recovery"],
    };
  }

  return {
    eligible: false,
    reason: "No safe replay checkpoint is available for this exception.",
    unsafeReasons: ["no_safe_checkpoint"],
  };
}

export interface ReconciliationWorkerOptions {
  jobStore: ProvisioningJobStore;
  receiptStore: DownstreamReceiptStore;
  resultStore: ReconciliationResultStore;
  exceptionQueue: ExceptionQueueStore;
  now?: () => string;
}

export interface ReconciliationWorkerRun {
  runId: string;
  checkedAt: string;
  results: RecordedReconciliationResult[];
  exceptions: ExceptionQueueRecord[];
}

export class ReconciliationWorker {
  private readonly jobStore: ProvisioningJobStore;
  private readonly receiptStore: DownstreamReceiptStore;
  private readonly resultStore: ReconciliationResultStore;
  private readonly exceptionQueue: ExceptionQueueStore;
  private readonly now: () => string;

  constructor(options: ReconciliationWorkerOptions) {
    this.jobStore = options.jobStore;
    this.receiptStore = options.receiptStore;
    this.resultStore = options.resultStore;
    this.exceptionQueue = options.exceptionQueue;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  scanJobs(
    statuses: ProvisioningJobStatus[] = ["completed", "retry_pending", "failed"],
  ): ReconciliationWorkerRun {
    const checkedAt = this.now();
    const runId = ["reconciliation-run", checkedAt].join("-");
    const jobs = statuses.flatMap((status) => this.jobStore.listByStatus(status));
    const results: RecordedReconciliationResult[] = [];
    const exceptions: ExceptionQueueRecord[] = [];

    jobs.forEach((job, index) => {
      const receipt = this.receiptStore.getByJobId(job.jobId);
      const reconciliation = classifyReconciliation({
        job,
        checkedAt,
        receipt,
        requireReceiptEvidence: true,
      });
      const recorded = createRecordedReconciliationResult({
        job,
        reconciliation,
        runId,
        sequence: index + 1,
      });
      this.resultStore.save(recorded);
      results.push(recorded);

      if (shouldQueueException(reconciliation)) {
        const timestamp = this.now();
        const existing = this.exceptionQueue.getOpenByJobId(job.jobId);
        const exception = buildExceptionRecord({
          existing,
          job,
          reconciliation,
          timestamp,
        });
        this.exceptionQueue.save(exception);
        exceptions.push(exception);
      }
    });

    return {
      runId,
      checkedAt,
      results,
      exceptions,
    };
  }
}

export class AuditedProvisioningService {
  private readonly orchestrator: ProvisioningOrchestrator;
  private readonly jobStore: ProvisioningJobStore;
  private readonly auditLedger: AuditLedgerStore;
  private readonly exceptionQueue: ExceptionQueueStore;
  private readonly receiptStore: DownstreamReceiptStore;
  private readonly now: () => string;

  constructor(options: AuditedProvisioningServiceOptions) {
    this.orchestrator = options.orchestrator;
    this.jobStore = options.jobStore;
    this.auditLedger = options.auditLedger;
    this.exceptionQueue = options.exceptionQueue;
    this.receiptStore = options.receiptStore ?? new InMemoryDownstreamReceiptStore();
    this.now = options.now ?? (() => new Date().toISOString());
  }

  private appendEvent(input: {
    job: ProvisioningJobV1;
    type: AuditEventType;
    summary: string;
    metadata?: Record<string, string>;
  }): AuditLedgerEvent {
    const occurredAt = this.now();
    const sequence = this.auditLedger.listByJobId(input.job.jobId).length + 1;
    const event: AuditLedgerEvent = {
      eventId: [
        "audit",
        sanitizeToken(input.job.jobId),
        String(sequence).padStart(3, "0"),
        sanitizeToken(input.type),
      ].join("-"),
      occurredAt,
      correlationId: input.job.correlationId,
      jobId: input.job.jobId,
      decisionId: input.job.decisionId,
      type: input.type,
      summary: input.summary,
      metadata: input.metadata,
    };
    this.auditLedger.append(event);
    return event;
  }

  private getJobById(jobId: string): ProvisioningJobV1 | undefined {
    return ["pending", "in_progress", "retry_pending", "completed", "failed"]
      .flatMap((status) => this.jobStore.listByStatus(status as ProvisioningJobStatus))
      .find((job) => job.jobId === jobId);
  }

  runReconciliation(
    job: ProvisioningJobV1,
    receipt?: DownstreamReceiptRecord,
  ): ReconciliationResult {
    return classifyReconciliation({
      job,
      checkedAt: this.now(),
      receipt,
      requireReceiptEvidence: false,
    });
  }

  private upsertException(
    job: ProvisioningJobV1,
    reconciliation: ReconciliationResult,
  ): ExceptionQueueRecord | undefined {
    if (!shouldQueueException(reconciliation)) {
      return undefined;
    }

    const timestamp = this.now();
    const existing = this.exceptionQueue.getOpenByJobId(job.jobId);
    const record = buildExceptionRecord({
      existing,
      job,
      reconciliation,
      timestamp,
    });
    this.exceptionQueue.save(record);
    return record;
  }

  listExceptions(filters: ExceptionQueueFilters = {}): ExceptionQueueRecord[] {
    return this.exceptionQueue.list(filters);
  }

  getReplayCheckpointEvaluation(input: {
    exceptionId: string;
  }): ReplayCheckpointEvaluation {
    const exception = this.exceptionQueue.getById(input.exceptionId);
    const job = exception ? this.getJobById(exception.jobId) : undefined;
    const receipt = exception
      ? this.receiptStore.getByJobId(exception.jobId)
      : undefined;

    return evaluateReplayCheckpoint({
      exception,
      job,
      receipt,
    });
  }

  triageException(input: {
    exceptionId: string;
    actor: string;
    note: string;
    status?: ExceptionQueueStatus;
  }): ExceptionQueueRecord {
    const existing = this.exceptionQueue.getById(input.exceptionId);
    if (!existing) {
      throw new Error("Exception record was not found.");
    }

    const actedAt = this.now();
    const nextStatus = input.status ?? existing.status;
    const actionType: ExceptionQueueActionType =
      nextStatus === "resolved" ? "resolved" : "note_added";
    const updated: ExceptionQueueRecord = {
      ...existing,
      status: nextStatus,
      updatedAt: actedAt,
      notes: [...existing.notes, input.note],
      triageActions: [
        ...existing.triageActions,
        createTriageAction({
          exceptionId: existing.exceptionId,
          sequence: existing.triageActions.length + 1,
          actionType,
          actor: input.actor,
          actedAt,
          note: input.note,
        }),
      ],
    };
    this.exceptionQueue.save(updated);

    this.auditLedger.append({
      eventId: [
        "audit",
        sanitizeToken(updated.jobId),
        String(this.auditLedger.listByJobId(updated.jobId).length + 1).padStart(
          3,
          "0",
        ),
        "exception-triaged",
      ].join("-"),
      occurredAt: actedAt,
      correlationId: updated.correlationId,
      jobId: updated.jobId,
      decisionId: updated.decisionId,
      type: "exception.triaged",
      summary: `Exception ${updated.exceptionId} triaged as ${nextStatus}.`,
      metadata: {
        actor: input.actor,
        status: nextStatus,
        note: input.note,
      },
    });

    return updated;
  }

  async processDecision(input: {
    application: CanonicalApplicationV1;
    decision: DecisionRecordV1;
    overlay: UniversityMappingOverlayV1;
  }): Promise<AuditedProvisioningOutcome> {
    const existingJob = this.jobStore.getByIdempotencyKey(
      createProvisioningIdempotencyKey(input.decision, input.overlay),
    );
    const result = await this.orchestrator.processDecision(input);
    const job = cloneJob(result.job);
    const auditEvents: AuditLedgerEvent[] = [];

    if (!existingJob) {
      auditEvents.push(
        this.appendEvent({
          job,
          type: "job.created",
          summary: "Provisioning job created from decision event.",
          metadata: {
            adapterMode: job.adapterMode,
            idempotencyKey: job.idempotencyKey,
          },
        }),
      );
    }

    if (result.attemptExecuted && job.attempts.length > 0) {
      const latestAttempt = job.attempts[job.attempts.length - 1];
      auditEvents.push(
        this.appendEvent({
          job,
          type: "job.attempt.recorded",
          summary: `Provisioning attempt ${latestAttempt.attemptNumber} recorded.`,
          metadata: {
            outcome: latestAttempt.outcome,
            errorCode: latestAttempt.errorCode ?? "",
          },
        }),
      );
    }

    const statusEventMap = {
      completed: "job.completed",
      retry_pending: "job.retry_pending",
      failed: "job.failed",
    } as const;
    const statusEventType = statusEventMap[job.status as keyof typeof statusEventMap];
    if (statusEventType) {
      auditEvents.push(
        this.appendEvent({
          job,
          type: statusEventType,
          summary: `Provisioning job is now ${job.status}.`,
        }),
      );
    }

    const reconciliation = this.runReconciliation(job);
    auditEvents.push(
      this.appendEvent({
        job,
        type: "job.reconciled",
        summary: reconciliation.details,
        metadata: {
          reconciliationStatus: reconciliation.status,
        },
      }),
    );

    const exception = this.upsertException(job, reconciliation);
    if (exception) {
      auditEvents.push(
        this.appendEvent({
          job,
          type: "exception.queued",
          summary: `Exception queued for ${exception.reasonCode}.`,
          metadata: {
            exceptionId: exception.exceptionId,
          },
        }),
      );
    }

    return {
      result: {
        ...result,
        job,
      },
      auditEvents,
      reconciliation,
      exception,
    };
  }

  async replayException(input: {
    exceptionId: string;
    operatorNote: string;
    operatorId?: string;
    checkpoint?: ReplayCheckpoint;
    application: CanonicalApplicationV1;
    decision: DecisionRecordV1;
    overlay: UniversityMappingOverlayV1;
  }): Promise<AuditedProvisioningOutcome> {
    const existing = this.exceptionQueue.getById(input.exceptionId);
    const job = existing ? this.getJobById(existing.jobId) : undefined;
    const receipt = existing
      ? this.receiptStore.getByJobId(existing.jobId)
      : undefined;
    const evaluation = evaluateReplayCheckpoint({
      exception: existing,
      job,
      receipt,
    });

    if (!existing || !job) {
      throw new Error(evaluation.reason);
    }

    if (!evaluation.eligible) {
      this.appendEvent({
        job,
        type: "exception.replay_blocked",
        summary: `Replay blocked for exception ${existing.exceptionId}. ${evaluation.reason}`,
        metadata: {
          exceptionId: existing.exceptionId,
          unsafeReasons: evaluation.unsafeReasons.join(","),
          requestedCheckpoint: input.checkpoint ?? "",
        },
      });
      throw new Error(evaluation.reason);
    }

    if (input.checkpoint && input.checkpoint !== evaluation.checkpoint) {
      this.appendEvent({
        job,
        type: "exception.replay_blocked",
        summary:
          `Replay blocked for exception ${existing.exceptionId}. Requested checkpoint ${input.checkpoint} is not safe.`,
        metadata: {
          exceptionId: existing.exceptionId,
          requestedCheckpoint: input.checkpoint,
          safeCheckpoint: evaluation.checkpoint ?? "",
        },
      });
      throw new Error(
        `Replay from checkpoint ${input.checkpoint} is not safe. Use ${evaluation.checkpoint} instead.`,
      );
    }

    const replayTimestamp = this.now();
    const operatorId = input.operatorId ?? "operations-operator";
    const replayedRecord: ExceptionQueueRecord = {
      ...existing,
      updatedAt: replayTimestamp,
      lastReplayAt: replayTimestamp,
      notes: [...existing.notes, input.operatorNote],
      triageActions: [
        ...existing.triageActions,
        createTriageAction({
          exceptionId: existing.exceptionId,
          sequence: existing.triageActions.length + 1,
          actionType: "replayed",
          actor: operatorId,
          actedAt: replayTimestamp,
          note: input.operatorNote,
        }),
      ],
    };
    this.exceptionQueue.save(replayedRecord);

    if (evaluation.checkpoint === "execute") {
      const outcome = await this.processDecision({
        application: input.application,
        decision: input.decision,
        overlay: input.overlay,
      });
      const reconciledException: ExceptionQueueRecord = {
        ...replayedRecord,
        status: outcome.reconciliation.status === "matched" ? "replayed" : "open",
        reasonCode: outcome.reconciliation.status,
        summary: outcome.reconciliation.details,
        escalationState: outcome.reconciliation.escalationState,
        jobStatus: outcome.result.job.status,
        updatedAt: this.now(),
      };
      this.exceptionQueue.save(reconciledException);

      outcome.auditEvents.push(
        this.appendEvent({
          job: outcome.result.job,
          type: "exception.replayed",
          summary: `Exception ${reconciledException.exceptionId} replayed from execute checkpoint by operator.`,
          metadata: {
            exceptionId: reconciledException.exceptionId,
            actor: operatorId,
            note: input.operatorNote,
            checkpoint: evaluation.checkpoint,
          },
        }),
      );

      return {
        ...outcome,
        exception: reconciledException,
      };
    }

    const replayCheckpoint: ReplayCheckpoint = "reconcile";
    const reconciliation = this.runReconciliation(job, receipt);
    const reconciledException: ExceptionQueueRecord =
      reconciliation.status === "matched"
        ? {
            ...replayedRecord,
            status: "replayed",
            reasonCode: reconciliation.status,
            summary: reconciliation.details,
            escalationState: reconciliation.escalationState,
            jobStatus: job.status,
            updatedAt: this.now(),
          }
        : buildExceptionRecord({
            existing: replayedRecord,
            job,
            reconciliation,
            timestamp: this.now(),
          });
    this.exceptionQueue.save(reconciledException);

    const auditEvents = [
      this.appendEvent({
        job,
        type: "job.reconciled",
        summary: reconciliation.details,
        metadata: {
          reconciliationStatus: reconciliation.status,
          replayCheckpoint,
        },
      }),
      this.appendEvent({
        job,
        type: "exception.replayed",
        summary: `Exception ${reconciledException.exceptionId} replayed from reconcile checkpoint by operator.`,
        metadata: {
          exceptionId: reconciledException.exceptionId,
          actor: operatorId,
          note: input.operatorNote,
          checkpoint: replayCheckpoint,
        },
      }),
    ];

    return {
      result: {
        job,
        selectedAdapterMode: job.adapterMode,
        attemptExecuted: false,
      },
      auditEvents,
      reconciliation,
      exception: reconciledException,
    };
  }
}
