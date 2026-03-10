import { describe, expect, it } from "vitest";
import {
  canonicalApplicationSamples,
  universityMappingOverlaySamples,
} from "./examples";
import {
  AdapterExecutionError,
  type DecisionRecordV1,
  InMemoryProvisioningJobStore,
  ProvisioningOrchestrator,
  createProvisioningIdempotencyKey,
  createProvisioningJob,
  decisionRecordSchemaDefaults,
  type UniversityAdapter,
} from "./provisioning";

function createDecisionRecord(
  overrides: Partial<DecisionRecordV1> = {},
): DecisionRecordV1 {
  return {
    ...decisionRecordSchemaDefaults,
    decisionId: "decision-001",
    applicationId: canonicalApplicationSamples[0].applicationId,
    applicantId: canonicalApplicationSamples[0].applicantId,
    partnerId: universityMappingOverlaySamples[0].partnerId,
    partnerName: universityMappingOverlaySamples[0].partnerName,
    decidedAt: "2026-03-10T12:00:00Z",
    decidedBy: "admissions.analyst@keypath.com",
    correlationId: "corr-001",
    outcome: {
      status: "offer-made",
    },
    ...overrides,
  };
}

function createStubAdapter(mode: UniversityAdapter["mode"]): UniversityAdapter {
  return {
    mode,
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
    execute: (prepared, context) => ({
      accepted: true,
      externalReference: `${prepared.adapterMode}:${context.idempotencyKey}`,
      submittedAt: "2026-03-10T12:01:00Z",
    }),
    verify: (prepared, execution) => ({
      verified: true,
      verifiedAt: "2026-03-10T12:02:00Z",
      externalReference: execution.externalReference,
    }),
    reconcile: () => ({
      status: "matched",
      reconciledAt: "2026-03-10T12:03:00Z",
    }),
  };
}

describe("ProvisioningOrchestrator", () => {
  it("creates one deterministic provisioning job per decision event", async () => {
    const store = new InMemoryProvisioningJobStore();
    const orchestrator = new ProvisioningOrchestrator({
      adapters: [createStubAdapter("file")],
      jobStore: store,
      now: () => "2026-03-10T12:00:00Z",
    });

    const decision = createDecisionRecord();
    const overlay = universityMappingOverlaySamples[0];
    const result = await orchestrator.processDecision({
      application: canonicalApplicationSamples[0],
      decision,
      overlay,
    });

    expect(result.job.jobId).toBe("prov-decision-001-scu-file");
    expect(result.job.idempotencyKey).toBe(
      createProvisioningIdempotencyKey(decision, overlay),
    );
    expect(result.job.status).toBe("completed");
    expect(result.job.attempts).toHaveLength(1);
  });

  it("retries safely with the same idempotency key and without creating a second job", async () => {
    const store = new InMemoryProvisioningJobStore();
    const executionKeys: string[] = [];
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
      execute: (prepared, context) => {
        callCount += 1;
        executionKeys.push(context.idempotencyKey);

        if (callCount === 1) {
          throw new AdapterExecutionError(
            "upstream_timeout",
            "Partner API timed out.",
            true,
          );
        }

        return {
          accepted: true,
          externalReference: `file:${context.idempotencyKey}`,
          submittedAt: "2026-03-10T12:05:00Z",
        };
      },
      verify: (_prepared, execution) => ({
        verified: true,
        verifiedAt: "2026-03-10T12:06:00Z",
        externalReference: execution.externalReference,
      }),
      reconcile: () => ({
        status: "matched",
        reconciledAt: "2026-03-10T12:07:00Z",
      }),
    };

    const orchestrator = new ProvisioningOrchestrator({
      adapters: [flakyAdapter],
      jobStore: store,
      maxAttempts: 3,
      now: () => "2026-03-10T12:00:00Z",
    });

    const input = {
      application: canonicalApplicationSamples[0],
      decision: createDecisionRecord(),
      overlay: universityMappingOverlaySamples[0],
    };

    const firstAttempt = await orchestrator.processDecision(input);
    const secondAttempt = await orchestrator.processDecision(input);
    const completedAttempt = await orchestrator.processDecision(input);

    expect(firstAttempt.job.status).toBe("retry_pending");
    expect(secondAttempt.job.status).toBe("completed");
    expect(secondAttempt.job.jobId).toBe(firstAttempt.job.jobId);
    expect(secondAttempt.job.attempts).toHaveLength(2);
    expect(executionKeys).toEqual([
      secondAttempt.job.idempotencyKey,
      secondAttempt.job.idempotencyKey,
    ]);
    expect(completedAttempt.attemptExecuted).toBe(false);
    expect(callCount).toBe(2);
  });

  it("switches adapter mode from the partner capability profile without changing the input schema", async () => {
    const store = new InMemoryProvisioningJobStore();
    const calledModes: string[] = [];
    const fileAdapter: UniversityAdapter = {
      ...createStubAdapter("file"),
      execute: (prepared, context) => {
        calledModes.push("file");
        return {
          accepted: true,
          externalReference: `file:${context.idempotencyKey}`,
          submittedAt: "2026-03-10T12:10:00Z",
        };
      },
    };
    const portalAdapter: UniversityAdapter = {
      ...createStubAdapter("portal-rpa"),
      execute: (prepared, context) => {
        calledModes.push("portal-rpa");
        return {
          accepted: true,
          externalReference: `portal:${context.idempotencyKey}`,
          submittedAt: "2026-03-10T12:11:00Z",
        };
      },
    };
    const orchestrator = new ProvisioningOrchestrator({
      adapters: [fileAdapter, portalAdapter],
      jobStore: store,
      now: () => "2026-03-10T12:00:00Z",
    });

    const decision = createDecisionRecord();
    const fileOverlay = universityMappingOverlaySamples[0];
    const portalOverlay = {
      ...universityMappingOverlaySamples[0],
      capabilityProfile: {
        ...universityMappingOverlaySamples[0].capabilityProfile,
        transportMode: "portal-rpa" as const,
      },
    };

    const fileResult = await orchestrator.processDecision({
      application: canonicalApplicationSamples[0],
      decision,
      overlay: fileOverlay,
    });
    const portalResult = await orchestrator.processDecision({
      application: canonicalApplicationSamples[0],
      decision: createDecisionRecord({ decisionId: "decision-002", correlationId: "corr-002" }),
      overlay: portalOverlay,
    });

    expect(fileResult.selectedAdapterMode).toBe("file");
    expect(portalResult.selectedAdapterMode).toBe("portal-rpa");
    expect(calledModes).toEqual(["file", "portal-rpa"]);
  });

  it("builds deterministic jobs before execution for downstream planning", () => {
    const decision = createDecisionRecord();
    const job = createProvisioningJob(
      decision,
      universityMappingOverlaySamples[0],
      "2026-03-10T12:00:00Z",
      4,
    );

    expect(job).toMatchObject({
      jobId: "prov-decision-001-scu-file",
      idempotencyKey: "decision-001:SCU:file",
      maxAttempts: 4,
      status: "pending",
      attempts: [],
    });
  });
});
