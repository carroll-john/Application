import { describe, expect, it } from "vitest";
import {
  canonicalApplicationSamples,
  universityMappingOverlaySamples,
} from "./examples";
import {
  createEdgeConnectorAdapter,
  createImportWorkflowAdapter,
  createScaffoldedAdapterRegistry,
} from "./adapterScaffolds";
import {
  validateImportWorkflowDispatchPayload,
  type ImportWorkflowDispatchPayloadV1,
} from "./importWorkflowContracts";
import {
  InMemoryProvisioningJobStore,
  ProvisioningOrchestrator,
  decisionRecordSchemaDefaults,
  type DecisionRecordV1,
} from "./provisioning";

function createDecisionRecord(
  overrides: Partial<DecisionRecordV1> = {},
): DecisionRecordV1 {
  return {
    ...decisionRecordSchemaDefaults,
    decisionId: "decision-scaffold-001",
    applicationId: canonicalApplicationSamples[0].applicationId,
    applicantId: canonicalApplicationSamples[0].applicantId,
    partnerId: universityMappingOverlaySamples[0].partnerId,
    partnerName: universityMappingOverlaySamples[0].partnerName,
    decidedAt: "2026-03-10T16:00:00Z",
    decidedBy: "admissions.analyst@keypath.com",
    correlationId: "corr-scaffold-001",
    outcome: {
      status: "offer-made",
    },
    ...overrides,
  };
}

describe("adapter scaffolds", () => {
  it("lists import-workflow and edge modes in the capability registry", () => {
    const registry = createScaffoldedAdapterRegistry();

    expect(registry.listModes()).toEqual(["import-workflow", "edge"]);
    expect(registry.getDescriptor("import-workflow")).toMatchObject({
      deploymentBoundary: "partner-import-runner",
      credentialBoundary: "partner-managed",
      requiresPrivateNetwork: false,
      verificationKinds: ["batch-status-poll", "delivery-receipt"],
    });
    expect(registry.getDescriptor("edge")).toMatchObject({
      deploymentBoundary: "private-edge-node",
      credentialBoundary: "edge-local",
      requiresPrivateNetwork: true,
      verificationKinds: ["edge-ack", "record-lookup"],
    });
  });

  it("captures import-workflow execution metadata and verification hooks consistently", async () => {
    const adapter = createImportWorkflowAdapter({
      workflowId: "tiu-managed-import",
      dropLocation: "s3://partner-import/tiu-managed-import",
    });
    const registry = createScaffoldedAdapterRegistry([adapter]);
    const jobStore = new InMemoryProvisioningJobStore();
    const orchestrator = new ProvisioningOrchestrator({
      adapters: registry.toAdapters(),
      jobStore,
      now: () => "2026-03-10T16:00:00Z",
    });
    const overlay = universityMappingOverlaySamples[1];

    const result = await orchestrator.processDecision({
      application: canonicalApplicationSamples[1],
      decision: createDecisionRecord({
        decisionId: "decision-import-001",
        applicationId: canonicalApplicationSamples[1].applicationId,
        applicantId: canonicalApplicationSamples[1].applicantId,
        partnerId: overlay.partnerId,
        partnerName: overlay.partnerName,
        correlationId: "corr-import-001",
      }),
      overlay,
    });

    expect(result.selectedAdapterMode).toBe("import-workflow");
    expect(result.job.routingDecision.routeKey).toBe(
      "import-workflow:tiu-managed-import",
    );
    expect(
      validateImportWorkflowDispatchPayload(
        result.preparedPayload?.dispatchPayload as ImportWorkflowDispatchPayloadV1,
      ),
    ).toMatchObject({ valid: true, errors: [] });
    expect(adapter.failureTaxonomy).toMatchObject({
      codeFailureClasses: {
        invalid_credentials: "authorization",
        invalid_payload: "data_quality",
        duplicate_record: "duplicate_record",
      },
      terminalCodes: [
        "invalid_credentials",
        "invalid_payload",
        "duplicate_record",
      ],
    });
    expect(result.preparedPayload?.executionMetadata).toMatchObject({
      dispatchChannel: "managed-import",
      dispatchTarget: "s3://partner-import/tiu-managed-import",
      workflowId: "tiu-managed-import",
      deploymentBoundary: "partner-import-runner",
      credentialBoundary: "partner-managed",
      dispatchPayloadSchema: "ImportWorkflowDispatchPayloadV1",
      dispatchPayloadVersion: "1.0.0",
      verificationReceiptSchema: "ImportWorkflowVerificationReceiptV1",
      requiresPrivateNetwork: "false",
      acceptsDocumentsInline: "true",
    });
    expect(result.preparedPayload?.verificationHooks).toEqual([
      {
        kind: "batch-status-poll",
        target: "tiu-managed-import/status",
        intervalMinutes: 5,
        timeoutMinutes: 60,
      },
      {
        kind: "delivery-receipt",
        target: "s3://partner-import/tiu-managed-import/receipts/tiu-managed-import",
        intervalMinutes: 5,
        timeoutMinutes: 60,
      },
    ]);
  });

  it("runs an edge-configured pilot partner without custom orchestration logic", async () => {
    const edgeAdapter = createEdgeConnectorAdapter({
      connectorId: "northbridge-edge-01",
      endpointRef: "edge://northbridge/private-network",
    });
    const registry = createScaffoldedAdapterRegistry([
      createImportWorkflowAdapter(),
      edgeAdapter,
    ]);
    const jobStore = new InMemoryProvisioningJobStore();
    const orchestrator = new ProvisioningOrchestrator({
      adapters: registry.toAdapters(),
      jobStore,
      now: () => "2026-03-10T16:00:00Z",
    });
    const overlay = universityMappingOverlaySamples[3];

    const result = await orchestrator.processDecision({
      application: canonicalApplicationSamples[0],
      decision: createDecisionRecord({
        decisionId: "decision-edge-001",
        partnerId: overlay.partnerId,
        partnerName: overlay.partnerName,
        correlationId: "corr-edge-001",
      }),
      overlay,
    });

    expect(result.selectedAdapterMode).toBe("edge");
    expect(result.job.status).toBe("completed");
    expect(result.job.routingDecision.routeKey).toBe(
      "edge:northbridge-edge-01",
    );
    expect(edgeAdapter.failureTaxonomy).toMatchObject({
      codeFailureClasses: {
        invalid_credentials: "authorization",
        configuration_error: "configuration",
        network_unreachable: "connectivity",
      },
      terminalCodes: ["invalid_credentials", "configuration_error"],
    });
    expect(result.preparedPayload?.executionMetadata).toMatchObject({
      dispatchChannel: "edge-connector",
      dispatchTarget: "edge://northbridge/private-network",
      connectorId: "northbridge-edge-01",
      deploymentBoundary: "private-edge-node",
      credentialBoundary: "edge-local",
      requiresPrivateNetwork: "true",
    });
    expect(result.preparedPayload?.verificationHooks?.map((hook) => hook.kind)).toEqual([
      "edge-ack",
      "record-lookup",
    ]);
  });

  it("maps import-workflow receipt states into provisioning outcomes", async () => {
    const overlay = universityMappingOverlaySamples[1];

    const pendingAdapter = createImportWorkflowAdapter({
      workflowId: "pending-import",
      verificationStatus: "processing",
      verificationDetails: "Batch runner has accepted the handoff but not finished.",
    });
    const completedAdapter = createImportWorkflowAdapter({
      workflowId: "completed-import",
      verificationStatus: "imported",
    });
    const rejectedAdapter = createImportWorkflowAdapter({
      workflowId: "rejected-import",
      verificationStatus: "rejected",
      verificationReasonCode: "invalid_payload",
      verificationDetails: "Course line code was missing from the manifest.",
    });

    const pendingOrchestrator = new ProvisioningOrchestrator({
      adapters: [pendingAdapter],
      jobStore: new InMemoryProvisioningJobStore(),
      now: () => "2026-03-10T16:20:00Z",
    });
    const completedOrchestrator = new ProvisioningOrchestrator({
      adapters: [completedAdapter],
      jobStore: new InMemoryProvisioningJobStore(),
      now: () => "2026-03-10T16:20:00Z",
    });
    const rejectedOrchestrator = new ProvisioningOrchestrator({
      adapters: [rejectedAdapter],
      jobStore: new InMemoryProvisioningJobStore(),
      now: () => "2026-03-10T16:20:00Z",
    });

    const baseDecision = createDecisionRecord({
      applicationId: canonicalApplicationSamples[1].applicationId,
      applicantId: canonicalApplicationSamples[1].applicantId,
      partnerId: overlay.partnerId,
      partnerName: overlay.partnerName,
    });

    const pendingResult = await pendingOrchestrator.processDecision({
      application: canonicalApplicationSamples[1],
      decision: {
        ...baseDecision,
        decisionId: "decision-import-pending",
        correlationId: "corr-import-pending",
      },
      overlay,
    });
    const completedResult = await completedOrchestrator.processDecision({
      application: canonicalApplicationSamples[1],
      decision: {
        ...baseDecision,
        decisionId: "decision-import-completed",
        correlationId: "corr-import-completed",
      },
      overlay,
    });
    const rejectedResult = await rejectedOrchestrator.processDecision({
      application: canonicalApplicationSamples[1],
      decision: {
        ...baseDecision,
        decisionId: "decision-import-rejected",
        correlationId: "corr-import-rejected",
      },
      overlay,
    });

    expect(pendingResult.job.status).toBe("retry_pending");
    expect(pendingResult.job.lastErrorCode).toBe("reconciliation_pending");
    expect(completedResult.job.status).toBe("completed");
    expect(rejectedResult.job.status).toBe("failed");
    expect(rejectedResult.job.terminalFailureCode).toBe("invalid_payload");
    expect(rejectedResult.job.terminalFailureClass).toBe("data_quality");
  });
});
