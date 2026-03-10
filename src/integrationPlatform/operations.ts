import type {
  CanonicalApplicationV1,
  UniversityMappingOverlayV1,
} from "./contracts";
import {
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
  | "job_not_terminal";

export interface ReconciliationResult {
  jobId: string;
  correlationId: string;
  status: ReconciliationStatus;
  checkedAt: string;
  details: string;
}

export type ExceptionQueueStatus = "open" | "replayed" | "resolved";

export interface ExceptionQueueRecord {
  exceptionId: string;
  jobId: string;
  correlationId: string;
  reasonCode: ReconciliationStatus;
  status: ExceptionQueueStatus;
  createdAt: string;
  updatedAt: string;
  notes: string[];
  lastReplayAt?: string;
}

export interface ExceptionQueueStore {
  getById(exceptionId: string): ExceptionQueueRecord | undefined;
  getOpenByJobId(jobId: string): ExceptionQueueRecord | undefined;
  save(record: ExceptionQueueRecord): void;
}

function cloneExceptionRecord(record: ExceptionQueueRecord): ExceptionQueueRecord {
  return {
    ...record,
    notes: [...record.notes],
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

  save(record: ExceptionQueueRecord): void {
    this.exceptions.set(record.exceptionId, cloneExceptionRecord(record));
  }
}

export interface AuditedProvisioningServiceOptions {
  orchestrator: ProvisioningOrchestrator;
  jobStore: ProvisioningJobStore;
  auditLedger: AuditLedgerStore;
  exceptionQueue: ExceptionQueueStore;
  now?: () => string;
}

export interface AuditedProvisioningOutcome {
  result: OrchestrationResult;
  auditEvents: AuditLedgerEvent[];
  reconciliation: ReconciliationResult;
  exception?: ExceptionQueueRecord;
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

export class AuditedProvisioningService {
  private readonly orchestrator: ProvisioningOrchestrator;
  private readonly jobStore: ProvisioningJobStore;
  private readonly auditLedger: AuditLedgerStore;
  private readonly exceptionQueue: ExceptionQueueStore;
  private readonly now: () => string;

  constructor(options: AuditedProvisioningServiceOptions) {
    this.orchestrator = options.orchestrator;
    this.jobStore = options.jobStore;
    this.auditLedger = options.auditLedger;
    this.exceptionQueue = options.exceptionQueue;
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

  runReconciliation(job: ProvisioningJobV1): ReconciliationResult {
    if (job.status === "completed" && job.targetRecordRef) {
      return {
        jobId: job.jobId,
        correlationId: job.correlationId,
        status: "matched",
        checkedAt: this.now(),
        details: `Matched downstream record ${job.targetRecordRef}.`,
      };
    }

    if (job.status === "completed" && !job.targetRecordRef) {
      return {
        jobId: job.jobId,
        correlationId: job.correlationId,
        status: "partial_delivery",
        checkedAt: this.now(),
        details: "Provisioning completed without a downstream target reference.",
      };
    }

    if (job.status === "failed" || job.status === "retry_pending") {
      return {
        jobId: job.jobId,
        correlationId: job.correlationId,
        status: job.targetRecordRef ? "partial_delivery" : "missing_target_record",
        checkedAt: this.now(),
        details: job.targetRecordRef
          ? "Provisioning has a partial downstream footprint but did not complete cleanly."
          : "No downstream target record could be verified for this job.",
      };
    }

    return {
      jobId: job.jobId,
      correlationId: job.correlationId,
      status: "job_not_terminal",
      checkedAt: this.now(),
      details: "Provisioning job is still pending or in progress.",
    };
  }

  private upsertException(
    job: ProvisioningJobV1,
    reconciliation: ReconciliationResult,
  ): ExceptionQueueRecord | undefined {
    if (
      reconciliation.status === "matched" ||
      reconciliation.status === "job_not_terminal"
    ) {
      return undefined;
    }

    const existing = this.exceptionQueue.getOpenByJobId(job.jobId);
    if (existing) {
      return existing;
    }

    const timestamp = this.now();
    const record: ExceptionQueueRecord = {
      exceptionId: `exception-${sanitizeToken(job.jobId)}`,
      jobId: job.jobId,
      correlationId: job.correlationId,
      reasonCode: reconciliation.status,
      status: "open",
      createdAt: timestamp,
      updatedAt: timestamp,
      notes: [],
    };
    this.exceptionQueue.save(record);
    return record;
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
    application: CanonicalApplicationV1;
    decision: DecisionRecordV1;
    overlay: UniversityMappingOverlayV1;
  }): Promise<AuditedProvisioningOutcome> {
    const existing = this.exceptionQueue.getById(input.exceptionId);
    if (!existing || existing.status !== "open") {
      throw new Error("Exception record is not open for replay.");
    }

    const replayTimestamp = this.now();
    const replayedRecord: ExceptionQueueRecord = {
      ...existing,
      updatedAt: replayTimestamp,
      lastReplayAt: replayTimestamp,
      notes: [...existing.notes, input.operatorNote],
    };
    this.exceptionQueue.save(replayedRecord);

    const outcome = await this.processDecision({
      application: input.application,
      decision: input.decision,
      overlay: input.overlay,
    });
    const reconciledException: ExceptionQueueRecord = {
      ...replayedRecord,
      status: outcome.reconciliation.status === "matched" ? "replayed" : "open",
      reasonCode: outcome.reconciliation.status,
      updatedAt: this.now(),
    };
    this.exceptionQueue.save(reconciledException);

    outcome.auditEvents.push(
      this.appendEvent({
        job: outcome.result.job,
        type: "exception.replayed",
        summary: `Exception ${reconciledException.exceptionId} replayed by operator.`,
        metadata: {
          exceptionId: reconciledException.exceptionId,
          note: input.operatorNote,
        },
      }),
    );

    return {
      ...outcome,
      exception: reconciledException,
    };
  }
}
