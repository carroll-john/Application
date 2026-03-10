import { describe, expect, it } from "vitest";
import {
  AuditedProvisioningService,
  InMemoryAuditLedgerStore,
  InMemoryExceptionQueueStore,
} from "./operations";
import {
  createPortalRpaFallbackAdapter,
  InMemoryPortalRpaTelemetryStore,
} from "./portalRpaFallback";
import {
  decisionRecordSchemaDefaults,
  InMemoryProvisioningJobStore,
  ProvisioningOrchestrator,
  type DecisionRecordV1,
} from "./provisioning";
import {
  canonicalApplicationSamples,
  universityMappingOverlaySamples,
} from "./examples";

function createDecisionRecord(
  overrides: Partial<DecisionRecordV1> = {},
): DecisionRecordV1 {
  return {
    ...decisionRecordSchemaDefaults,
    decisionId: "decision-rpa-001",
    applicationId: canonicalApplicationSamples[2].applicationId,
    applicantId: canonicalApplicationSamples[2].applicantId,
    partnerId: "HHI",
    partnerName: "Harbour Health Institute",
    decidedAt: "2026-03-10T18:00:00Z",
    decidedBy: "admissions.analyst@keypath.com.au",
    correlationId: "corr-rpa-001",
    outcome: {
      status: "offer-made",
    },
    ...overrides,
  };
}

describe("portalRpaFallback", () => {
  it("records deterministic run evidence and measurable success rate for completed runs", async () => {
    const telemetryStore = new InMemoryPortalRpaTelemetryStore();
    const jobStore = new InMemoryProvisioningJobStore();
    const orchestrator = new ProvisioningOrchestrator({
      adapters: [
        createPortalRpaFallbackAdapter({
          telemetryStore,
        }),
      ],
      jobStore,
      now: () => "2026-03-10T18:00:00Z",
    });

    const result = await orchestrator.processDecision({
      application: canonicalApplicationSamples[2],
      decision: createDecisionRecord(),
      overlay: universityMappingOverlaySamples[2],
    });

    expect(result.job.adapterMode).toBe("portal-rpa");
    expect(result.job.status).toBe("completed");
    expect(
      telemetryStore.listEvidence({ jobId: result.job.jobId }).map((event) => event.stepKey),
    ).toEqual([
      "portal.open-search",
      "portal.lookup-applicant",
      "portal.open-application",
      "portal.submit-decision",
      "portal.capture-confirmation",
      "portal.verify-target-record",
      "portal.reconcile-run",
    ]);
    expect(telemetryStore.listDriftSignals({ jobId: result.job.jobId })).toHaveLength(0);
    expect(telemetryStore.listRunRecords({ jobId: result.job.jobId })[0]).toMatchObject({
      runState: "completed",
    });
    expect(telemetryStore.listStatusViews()[0]).toMatchObject({
      completedRuns: 1,
      exceptionRuns: 0,
      successRate: 1,
      driftIncidentCount: 0,
    });
  });

  it("surfaces selector drift as a terminal exception with an explicit runbook", async () => {
    const telemetryStore = new InMemoryPortalRpaTelemetryStore();
    const jobStore = new InMemoryProvisioningJobStore();
    const auditLedger = new InMemoryAuditLedgerStore();
    const exceptionQueue = new InMemoryExceptionQueueStore();
    const service = new AuditedProvisioningService({
      orchestrator: new ProvisioningOrchestrator({
        adapters: [
          createPortalRpaFallbackAdapter({
            driftStepKey: "portal.submit-decision",
            telemetryStore,
          }),
        ],
        jobStore,
        now: () => "2026-03-10T18:10:00Z",
      }),
      jobStore,
      auditLedger,
      exceptionQueue,
      now: () => "2026-03-10T18:10:00Z",
    });

    const outcome = await service.processDecision({
      application: canonicalApplicationSamples[2],
      decision: createDecisionRecord({
        decisionId: "decision-rpa-002",
        correlationId: "corr-rpa-002",
      }),
      overlay: universityMappingOverlaySamples[2],
    });

    expect(outcome.result.job.status).toBe("failed");
    expect(outcome.exception).toMatchObject({
      adapterMode: "portal-rpa",
      failureCode: "selector_drift",
      failureClass: "configuration",
      status: "open",
    });
    expect(telemetryStore.listDriftSignals({ jobId: outcome.result.job.jobId })[0]).toMatchObject({
      runbookId: "portal-rpa.selector-drift",
      selectorKey: "portal.submit-decision",
    });
    expect(telemetryStore.listRunRecords({ jobId: outcome.result.job.jobId })[0]).toMatchObject({
      runState: "exception",
      errorCode: "selector_drift",
      runbookId: "portal-rpa.selector-drift",
    });
    expect(telemetryStore.listStatusViews()[0]).toMatchObject({
      completedRuns: 0,
      exceptionRuns: 1,
      successRate: 0,
      driftIncidentCount: 1,
      latestRunbookId: "portal-rpa.selector-drift",
    });
    expect(outcome.auditEvents.map((event) => event.type)).toContain("exception.queued");
  });
});
