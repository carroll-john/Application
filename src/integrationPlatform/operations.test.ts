import { describe, expect, it } from "vitest";
import { canonicalApplicationSamples, universityMappingOverlaySamples } from "./examples";
import {
  AdapterExecutionError,
  InMemoryProvisioningJobStore,
  ProvisioningOrchestrator,
  createProvisioningJob,
  decisionRecordSchemaDefaults,
  transitionProvisioningJob,
  type DecisionRecordV1,
  type UniversityAdapter,
} from "./provisioning";
import {
  AuditedProvisioningService,
  InMemoryAuditLedgerStore,
  InMemoryDownstreamReceiptStore,
  InMemoryExceptionQueueStore,
  InMemoryReconciliationResultStore,
  ReconciliationWorker,
} from "./operations";

function createDecisionRecord(overrides: Partial<DecisionRecordV1> = {}): DecisionRecordV1 {
  return {
    ...decisionRecordSchemaDefaults,
    decisionId: "decision-500",
    applicationId: canonicalApplicationSamples[0].applicationId,
    applicantId: canonicalApplicationSamples[0].applicantId,
    partnerId: universityMappingOverlaySamples[0].partnerId,
    partnerName: universityMappingOverlaySamples[0].partnerName,
    decidedAt: "2026-03-10T14:00:00Z",
    decidedBy: "admissions.analyst@keypath.com",
    correlationId: "corr-audit-500",
    outcome: {
      status: "offer-made",
    },
    ...overrides,
  };
}

function createDecisionRecordForOverlay(
  overlay: (typeof universityMappingOverlaySamples)[number],
  overrides: Partial<DecisionRecordV1> = {},
): DecisionRecordV1 {
  return createDecisionRecord({
    applicationId: canonicalApplicationSamples[0].applicationId,
    applicantId: canonicalApplicationSamples[0].applicantId,
    partnerId: overlay.partnerId,
    partnerName: overlay.partnerName,
    ...overrides,
  });
}

function createSuccessfulAdapter(): UniversityAdapter {
  return {
    mode: "file",
    prepare: ({ application, decision, job, overlay }) => ({
      envelopeId: `${job.jobId}-attempt-${job.attempts.length + 1}`,
      jobId: job.jobId,
      applicationId: application.applicationId,
      decisionId: decision.decisionId,
      adapterMode: overlay.capabilityProfile.transportMode,
      idempotencyKey: job.idempotencyKey,
      fieldCount: overlay.fieldMappings.length,
      documentCount: application.documents.length,
    }),
    execute: (_prepared, context) => ({
      accepted: true,
      externalReference: `record:${context.idempotencyKey}`,
      submittedAt: "2026-03-10T14:01:00Z",
    }),
    verify: (_prepared, execution) => ({
      verified: true,
      verifiedAt: "2026-03-10T14:02:00Z",
      externalReference: execution.externalReference,
    }),
    reconcile: () => ({
      status: "matched",
      reconciledAt: "2026-03-10T14:03:00Z",
    }),
  };
}

function createStoredTerminalJob(input: {
  decision: DecisionRecordV1;
  overlay: (typeof universityMappingOverlaySamples)[number];
  status: "completed" | "retry_pending" | "failed";
  targetRecordRef?: string;
}) {
  const job = createProvisioningJob(
    input.decision,
    input.overlay,
    "2026-03-10T15:00:00Z",
    3,
  );
  transitionProvisioningJob({
    job,
    toStatus: "in_progress",
    transitionedAt: "2026-03-10T15:01:00Z",
    reason: "Attempt 1 started.",
    metadata: { attemptNumber: "1" },
  });
  job.attempts.push({
    attemptNumber: 1,
    startedAt: "2026-03-10T15:01:00Z",
    completedAt: "2026-03-10T15:02:00Z",
    outcome: input.status === "completed" ? "succeeded" : "failed",
    externalReference: input.targetRecordRef,
    errorCode: input.status === "completed" ? undefined : "reconciliation_gap",
    errorMessage:
      input.status === "completed" ? undefined : "Reconciliation result was incomplete.",
  });
  if (input.targetRecordRef) {
    job.targetRecordRef = input.targetRecordRef;
  }
  transitionProvisioningJob({
    job,
    toStatus: input.status,
    transitionedAt: "2026-03-10T15:02:00Z",
    reason: `Attempt 1 finished as ${input.status}.`,
    metadata: { attemptNumber: "1" },
  });
  return job;
}

describe("AuditedProvisioningService", () => {
  it("records immutable lifecycle events with correlation ids for every provisioning job", async () => {
    const jobStore = new InMemoryProvisioningJobStore();
    const auditLedger = new InMemoryAuditLedgerStore();
    const exceptionQueue = new InMemoryExceptionQueueStore();
    const orchestrator = new ProvisioningOrchestrator({
      adapters: [createSuccessfulAdapter()],
      jobStore,
      now: () => "2026-03-10T14:00:00Z",
    });
    const service = new AuditedProvisioningService({
      orchestrator,
      jobStore,
      auditLedger,
      exceptionQueue,
      now: () => "2026-03-10T14:00:00Z",
    });

    const outcome = await service.processDecision({
      application: canonicalApplicationSamples[0],
      decision: createDecisionRecord(),
      overlay: universityMappingOverlaySamples[0],
    });

    expect(outcome.auditEvents.map((event) => event.type)).toEqual([
      "job.created",
      "job.attempt.recorded",
      "job.completed",
      "job.reconciled",
    ]);

    const storedEvents = auditLedger.listByJobId(outcome.result.job.jobId);
    expect(storedEvents).toHaveLength(4);
    expect(
      outcome.auditEvents.every(
        (event) => event.correlationId === outcome.result.job.correlationId,
      ),
    ).toBe(true);
    expect(new Set(storedEvents.map((event) => event.eventId)).size).toBe(storedEvents.length);

    storedEvents[0].summary = "mutated";
    expect(auditLedger.listByJobId(outcome.result.job.jobId)[0].summary).toBe(
      "Provisioning job created from decision event.",
    );
  });

  it("detects missing target records and queues an exception", async () => {
    const jobStore = new InMemoryProvisioningJobStore();
    const auditLedger = new InMemoryAuditLedgerStore();
    const exceptionQueue = new InMemoryExceptionQueueStore();
    const adapter: UniversityAdapter = {
      mode: "file",
      prepare: ({ application, decision, job, overlay }) => ({
        envelopeId: `${job.jobId}-attempt-${job.attempts.length + 1}`,
        jobId: job.jobId,
        applicationId: application.applicationId,
        decisionId: decision.decisionId,
        adapterMode: overlay.capabilityProfile.transportMode,
        idempotencyKey: job.idempotencyKey,
        fieldCount: overlay.fieldMappings.length,
        documentCount: application.documents.length,
      }),
      execute: () => ({
        accepted: true,
        externalReference: "record:temporary",
        submittedAt: "2026-03-10T14:04:00Z",
      }),
      verify: (_prepared, execution) => ({
        verified: false,
        verifiedAt: "2026-03-10T14:05:00Z",
        externalReference: execution.externalReference,
      }),
      reconcile: () => ({
        status: "exception",
        reconciledAt: "2026-03-10T14:06:00Z",
        details: "Downstream record could not be verified.",
      }),
    };
    const orchestrator = new ProvisioningOrchestrator({
      adapters: [adapter],
      jobStore,
      maxAttempts: 1,
      now: () => "2026-03-10T14:00:00Z",
    });
    const service = new AuditedProvisioningService({
      orchestrator,
      jobStore,
      auditLedger,
      exceptionQueue,
      now: () => "2026-03-10T14:00:00Z",
    });

    const outcome = await service.processDecision({
      application: canonicalApplicationSamples[0],
      decision: createDecisionRecord(),
      overlay: universityMappingOverlaySamples[0],
    });

    expect(outcome.result.job.status).toBe("failed");
    expect(outcome.reconciliation.status).toBe("partial_delivery");
    expect(outcome.exception?.status).toBe("open");
    expect(outcome.exception?.summary).toContain("partial downstream footprint");
    expect(outcome.exception?.partnerId).toBe("SCU");
    expect(outcome.auditEvents.map((event) => event.type)).toContain("exception.queued");
  });

  it("replays open exceptions and preserves operator notes", async () => {
    const jobStore = new InMemoryProvisioningJobStore();
    const auditLedger = new InMemoryAuditLedgerStore();
    const exceptionQueue = new InMemoryExceptionQueueStore();
    let callCount = 0;
    const flakyAdapter: UniversityAdapter = {
      mode: "file",
      prepare: ({ application, decision, job, overlay }) => ({
        envelopeId: `${job.jobId}-attempt-${job.attempts.length + 1}`,
        jobId: job.jobId,
        applicationId: application.applicationId,
        decisionId: decision.decisionId,
        adapterMode: overlay.capabilityProfile.transportMode,
        idempotencyKey: job.idempotencyKey,
        fieldCount: overlay.fieldMappings.length,
        documentCount: application.documents.length,
      }),
      execute: (_prepared, context) => {
        callCount += 1;
        if (callCount === 1) {
          throw new AdapterExecutionError(
            "partner_timeout",
            "Partner timed out.",
            true,
          );
        }
        return {
          accepted: true,
          externalReference: `record:${context.idempotencyKey}`,
          submittedAt: "2026-03-10T14:10:00Z",
        };
      },
      verify: (_prepared, execution) => ({
        verified: true,
        verifiedAt: "2026-03-10T14:11:00Z",
        externalReference: execution.externalReference,
      }),
      reconcile: () => ({
        status: "matched",
        reconciledAt: "2026-03-10T14:12:00Z",
      }),
    };
    const orchestrator = new ProvisioningOrchestrator({
      adapters: [flakyAdapter],
      jobStore,
      maxAttempts: 2,
      now: () => "2026-03-10T14:00:00Z",
    });
    const service = new AuditedProvisioningService({
      orchestrator,
      jobStore,
      auditLedger,
      exceptionQueue,
      now: () => "2026-03-10T14:00:00Z",
    });
    const input = {
      application: canonicalApplicationSamples[0],
      decision: createDecisionRecord(),
      overlay: universityMappingOverlaySamples[0],
    };

    const firstOutcome = await service.processDecision(input);
    expect(
      service.getReplayCheckpointEvaluation({
        exceptionId: firstOutcome.exception!.exceptionId,
      }),
    ).toEqual({
      eligible: true,
      checkpoint: "execute",
      reason:
        "The job is retry-pending with remaining attempt budget, so execute is the safe replay checkpoint.",
      unsafeReasons: [],
    });
    const replayOutcome = await service.replayException({
      exceptionId: firstOutcome.exception!.exceptionId,
      operatorId: "ops.analyst@keypath.com",
      operatorNote: "Retried after confirming partner portal availability.",
      ...input,
    });

    expect(firstOutcome.exception?.status).toBe("open");
    expect(replayOutcome.exception?.status).toBe("replayed");
    expect(replayOutcome.exception?.notes).toContain(
      "Retried after confirming partner portal availability.",
    );
    expect(replayOutcome.exception?.triageActions.at(-1)).toMatchObject({
      actionType: "replayed",
      actor: "ops.analyst@keypath.com",
    });
    expect(replayOutcome.result.job.status).toBe("completed");
    expect(replayOutcome.auditEvents.map((event) => event.type)).toContain(
      "exception.replayed",
    );
  });

  it("blocks unsafe checkpoint replay attempts with explicit reasons", async () => {
    const jobStore = new InMemoryProvisioningJobStore();
    const auditLedger = new InMemoryAuditLedgerStore();
    const exceptionQueue = new InMemoryExceptionQueueStore();
    const adapter: UniversityAdapter = {
      mode: "file",
      prepare: ({ application, decision, job, overlay }) => ({
        envelopeId: `${job.jobId}-attempt-${job.attempts.length + 1}`,
        jobId: job.jobId,
        applicationId: application.applicationId,
        decisionId: decision.decisionId,
        adapterMode: overlay.capabilityProfile.transportMode,
        idempotencyKey: job.idempotencyKey,
        fieldCount: overlay.fieldMappings.length,
        documentCount: application.documents.length,
      }),
      execute: () => ({
        accepted: true,
        externalReference: "record:block-720",
        submittedAt: "2026-03-10T14:20:00Z",
      }),
      verify: (_prepared, execution) => ({
        verified: false,
        verifiedAt: "2026-03-10T14:21:00Z",
        externalReference: execution.externalReference,
      }),
      reconcile: () => ({
        status: "exception",
        reconciledAt: "2026-03-10T14:22:00Z",
        details: "Downstream receipt has not arrived yet.",
      }),
    };
    const orchestrator = new ProvisioningOrchestrator({
      adapters: [adapter],
      jobStore,
      maxAttempts: 1,
      now: () => "2026-03-10T14:20:00Z",
    });
    const service = new AuditedProvisioningService({
      orchestrator,
      jobStore,
      auditLedger,
      exceptionQueue,
      receiptStore: new InMemoryDownstreamReceiptStore(),
      now: () => "2026-03-10T14:20:00Z",
    });
    const input = {
      application: canonicalApplicationSamples[0],
      decision: createDecisionRecord({
        decisionId: "decision-720",
        correlationId: "corr-720",
      }),
      overlay: universityMappingOverlaySamples[0],
    };

    const firstOutcome = await service.processDecision(input);

    expect(
      service.getReplayCheckpointEvaluation({
        exceptionId: firstOutcome.exception!.exceptionId,
      }),
    ).toEqual({
      eligible: false,
      reason:
        "Replay from reconcile checkpoint is blocked until a downstream receipt is available.",
      unsafeReasons: ["missing_downstream_receipt"],
    });

    await expect(
      service.replayException({
        exceptionId: firstOutcome.exception!.exceptionId,
        operatorId: "ops.lead@keypath.com",
        operatorNote: "Tried to replay before receipt arrived.",
        checkpoint: "execute",
        ...input,
      }),
    ).rejects.toThrow(
      "Replay from reconcile checkpoint is blocked until a downstream receipt is available.",
    );
    expect(
      auditLedger.listByJobId(firstOutcome.result.job.jobId).map((event) => event.type),
    ).toContain("exception.replay_blocked");
  });

  it("replays from reconcile checkpoint when downstream receipt evidence arrives", async () => {
    const jobStore = new InMemoryProvisioningJobStore();
    const auditLedger = new InMemoryAuditLedgerStore();
    const exceptionQueue = new InMemoryExceptionQueueStore();
    const receiptStore = new InMemoryDownstreamReceiptStore();
    const adapter: UniversityAdapter = {
      mode: "file",
      prepare: ({ application, decision, job, overlay }) => ({
        envelopeId: `${job.jobId}-attempt-${job.attempts.length + 1}`,
        jobId: job.jobId,
        applicationId: application.applicationId,
        decisionId: decision.decisionId,
        adapterMode: overlay.capabilityProfile.transportMode,
        idempotencyKey: job.idempotencyKey,
        fieldCount: overlay.fieldMappings.length,
        documentCount: application.documents.length,
      }),
      execute: () => ({
        accepted: true,
        externalReference: "record:reconcile-730",
        submittedAt: "2026-03-10T14:30:00Z",
      }),
      verify: (_prepared, execution) => ({
        verified: false,
        verifiedAt: "2026-03-10T14:31:00Z",
        externalReference: execution.externalReference,
      }),
      reconcile: () => ({
        status: "exception",
        reconciledAt: "2026-03-10T14:32:00Z",
        details: "Receipt confirmation is still pending.",
      }),
    };
    const orchestrator = new ProvisioningOrchestrator({
      adapters: [adapter],
      jobStore,
      maxAttempts: 1,
      now: () => "2026-03-10T14:30:00Z",
    });
    const service = new AuditedProvisioningService({
      orchestrator,
      jobStore,
      auditLedger,
      exceptionQueue,
      receiptStore,
      now: () => "2026-03-10T14:30:00Z",
    });
    const input = {
      application: canonicalApplicationSamples[0],
      decision: createDecisionRecord({
        decisionId: "decision-730",
        correlationId: "corr-730",
      }),
      overlay: universityMappingOverlaySamples[0],
    };

    const firstOutcome = await service.processDecision(input);
    receiptStore.save({
      jobId: firstOutcome.result.job.jobId,
      correlationId: firstOutcome.result.job.correlationId,
      observedAt: "2026-03-10T14:35:00Z",
      status: "received",
      externalReference: "record:reconcile-730",
    });

    expect(
      service.getReplayCheckpointEvaluation({
        exceptionId: firstOutcome.exception!.exceptionId,
      }),
    ).toEqual({
      eligible: true,
      checkpoint: "reconcile",
      reason:
        "A downstream footprint already exists, so reconcile is the safe replay checkpoint.",
      unsafeReasons: ["execute_would_risk_duplicate_side_effects"],
    });

    const replayOutcome = await service.replayException({
      exceptionId: firstOutcome.exception!.exceptionId,
      operatorId: "ops.lead@keypath.com",
      operatorNote: "Receipt arrived from the partner runner.",
      checkpoint: "reconcile",
      ...input,
    });

    expect(replayOutcome.result.attemptExecuted).toBe(false);
    expect(replayOutcome.result.job.attempts).toHaveLength(1);
    expect(replayOutcome.reconciliation.status).toBe("matched");
    expect(replayOutcome.exception?.status).toBe("replayed");
    expect(replayOutcome.auditEvents.map((event) => event.type)).toEqual([
      "job.reconciled",
      "exception.replayed",
    ]);
  });

  it("scans terminal jobs against downstream receipts and stores explicit reconciliation results", () => {
    const jobStore = new InMemoryProvisioningJobStore();
    const receiptStore = new InMemoryDownstreamReceiptStore();
    const resultStore = new InMemoryReconciliationResultStore();
    const exceptionQueue = new InMemoryExceptionQueueStore();
    const matchedOverlay = universityMappingOverlaySamples[0];
    const invalidOverlay = universityMappingOverlaySamples[1];

    const matchedJob = createStoredTerminalJob({
      decision: createDecisionRecordForOverlay(matchedOverlay, {
        decisionId: "decision-610",
        correlationId: "corr-610",
      }),
      overlay: matchedOverlay,
      status: "completed",
      targetRecordRef: "record:matched-610",
    });
    const partialJob = createStoredTerminalJob({
      decision: createDecisionRecordForOverlay(matchedOverlay, {
        decisionId: "decision-611",
        correlationId: "corr-611",
      }),
      overlay: matchedOverlay,
      status: "failed",
      targetRecordRef: "record:partial-611",
    });
    const invalidJob = createStoredTerminalJob({
      decision: createDecisionRecordForOverlay(invalidOverlay, {
        decisionId: "decision-612",
        correlationId: "corr-612",
      }),
      overlay: invalidOverlay,
      status: "completed",
      targetRecordRef: "record:expected-612",
    });

    jobStore.save(matchedJob);
    jobStore.save(partialJob);
    jobStore.save(invalidJob);

    receiptStore.save({
      jobId: matchedJob.jobId,
      correlationId: matchedJob.correlationId,
      observedAt: "2026-03-10T15:10:00Z",
      status: "received",
      externalReference: "record:matched-610",
    });
    receiptStore.save({
      jobId: invalidJob.jobId,
      correlationId: invalidJob.correlationId,
      observedAt: "2026-03-10T15:10:00Z",
      status: "invalid",
      externalReference: "record:wrong-612",
      details: "Destination receipt checksum failed validation.",
    });

    const worker = new ReconciliationWorker({
      jobStore,
      receiptStore,
      resultStore,
      exceptionQueue,
      now: () => "2026-03-10T15:15:00Z",
    });

    const run = worker.scanJobs();

    expect(run.results).toHaveLength(3);
    expect(
      resultStore.listLatest().map((result) => result.status).sort(),
    ).toEqual(["invalid_target_record", "matched", "partial_delivery"]);
    expect(
      resultStore.listLatest({
        partnerId: "TIU",
        adapterMode: "import-workflow",
        status: "invalid_target_record",
      }),
    ).toHaveLength(1);
    expect(
      resultStore.getLatestByJobId(partialJob.jobId),
    ).toMatchObject({
      status: "partial_delivery",
      escalationState: "queue_exception",
      expectedTargetRecordRef: "record:partial-611",
    });
    expect(
      exceptionQueue.list({ status: "open" }).map((record) => record.reasonCode).sort(),
    ).toEqual(["invalid_target_record", "partial_delivery"]);
  });

  it("lists exception queue records by operational filters and records triage actions", async () => {
    const jobStore = new InMemoryProvisioningJobStore();
    const auditLedger = new InMemoryAuditLedgerStore();
    const exceptionQueue = new InMemoryExceptionQueueStore();
    const adapter: UniversityAdapter = {
      mode: "file",
      prepare: ({ application, decision, job, overlay }) => ({
        envelopeId: `${job.jobId}-attempt-${job.attempts.length + 1}`,
        jobId: job.jobId,
        applicationId: application.applicationId,
        decisionId: decision.decisionId,
        adapterMode: overlay.capabilityProfile.transportMode,
        idempotencyKey: job.idempotencyKey,
        fieldCount: overlay.fieldMappings.length,
        documentCount: application.documents.length,
      }),
      execute: () => ({
        accepted: true,
        externalReference: "record:triage-700",
        submittedAt: "2026-03-10T16:01:00Z",
      }),
      verify: (_prepared, execution) => ({
        verified: false,
        verifiedAt: "2026-03-10T16:02:00Z",
        externalReference: execution.externalReference,
      }),
      reconcile: () => ({
        status: "exception",
        reconciledAt: "2026-03-10T16:03:00Z",
        details: "Partner receipt has not arrived yet.",
      }),
    };
    const orchestrator = new ProvisioningOrchestrator({
      adapters: [adapter],
      jobStore,
      maxAttempts: 1,
      now: () => "2026-03-10T16:00:00Z",
    });
    const service = new AuditedProvisioningService({
      orchestrator,
      jobStore,
      auditLedger,
      exceptionQueue,
      now: () => "2026-03-10T16:00:00Z",
    });

    const outcome = await service.processDecision({
      application: canonicalApplicationSamples[0],
      decision: createDecisionRecord({ decisionId: "decision-700", correlationId: "corr-700" }),
      overlay: universityMappingOverlaySamples[0],
    });

    expect(
      service.listExceptions({
        status: "open",
        partnerId: "SCU",
        adapterMode: "file",
        reasonCode: "partial_delivery",
      }),
    ).toHaveLength(1);

    const triaged = service.triageException({
      exceptionId: outcome.exception!.exceptionId,
      actor: "ops.lead@keypath.com",
      note: "Waiting for partner receipt replay window.",
      status: "resolved",
    });

    expect(triaged.status).toBe("resolved");
    expect(triaged.notes).toContain("Waiting for partner receipt replay window.");
    expect(triaged.triageActions).toEqual([
      {
        actionId: triaged.triageActions[0].actionId,
        actionType: "resolved",
        actor: "ops.lead@keypath.com",
        actedAt: triaged.triageActions[0].actedAt,
        note: "Waiting for partner receipt replay window.",
      },
    ]);
    expect(service.listExceptions({ status: "open" })).toHaveLength(0);
    expect(
      auditLedger.listByJobId(outcome.result.job.jobId).map((event) => event.type),
    ).toContain("exception.triaged");
  });
});
