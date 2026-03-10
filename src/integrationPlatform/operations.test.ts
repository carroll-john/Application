import { describe, expect, it } from "vitest";
import { canonicalApplicationSamples, universityMappingOverlaySamples } from "./examples";
import {
  AdapterExecutionError,
  InMemoryProvisioningJobStore,
  ProvisioningOrchestrator,
  decisionRecordSchemaDefaults,
  type DecisionRecordV1,
  type UniversityAdapter,
} from "./provisioning";
import {
  AuditedProvisioningService,
  InMemoryAuditLedgerStore,
  InMemoryExceptionQueueStore,
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
    const replayOutcome = await service.replayException({
      exceptionId: firstOutcome.exception!.exceptionId,
      operatorNote: "Retried after confirming partner portal availability.",
      ...input,
    });

    expect(firstOutcome.exception?.status).toBe("open");
    expect(replayOutcome.exception?.status).toBe("replayed");
    expect(replayOutcome.exception?.notes).toContain(
      "Retried after confirming partner portal availability.",
    );
    expect(replayOutcome.result.job.status).toBe("completed");
    expect(replayOutcome.auditEvents.map((event) => event.type)).toContain(
      "exception.replayed",
    );
  });
});
