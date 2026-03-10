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
    const registry = createScaffoldedAdapterRegistry([
      createImportWorkflowAdapter({
        workflowId: "tiu-managed-import",
        dropLocation: "s3://partner-import/tiu-managed-import",
      }),
    ]);
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
    expect(result.preparedPayload?.executionMetadata).toMatchObject({
      dispatchChannel: "managed-import",
      dispatchTarget: "s3://partner-import/tiu-managed-import",
      workflowId: "tiu-managed-import",
      deploymentBoundary: "partner-import-runner",
      credentialBoundary: "partner-managed",
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
    const registry = createScaffoldedAdapterRegistry([
      createImportWorkflowAdapter(),
      createEdgeConnectorAdapter({
        connectorId: "northbridge-edge-01",
        endpointRef: "edge://northbridge/private-network",
      }),
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
});
