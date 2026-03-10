import type {
  CanonicalApplicationV1,
  UniversityMappingOverlayV1,
} from "./contracts";
import type {
  AdapterMode,
  DecisionRecordV1,
  PreparedProvisioningPayload,
  UniversityAdapter,
  VerificationHookKind,
  VerificationHookV1,
} from "./provisioning";

export type ScaffoldedAdapterMode = Extract<
  AdapterMode,
  "import-workflow" | "edge"
>;

export type DeploymentBoundary =
  | "partner-import-runner"
  | "private-edge-node";

export type CredentialBoundary = "partner-managed" | "edge-local";

export type DispatchChannel = "managed-import" | "edge-connector";

export interface AdapterCapabilityDescriptor {
  mode: ScaffoldedAdapterMode;
  dispatchChannel: DispatchChannel;
  deploymentBoundary: DeploymentBoundary;
  credentialBoundary: CredentialBoundary;
  requiresPrivateNetwork: boolean;
  verificationKinds: VerificationHookKind[];
  assumptions: string[];
}

export interface ScaffoldedUniversityAdapter extends UniversityAdapter {
  readonly descriptor: AdapterCapabilityDescriptor;
}

export interface AdapterCapabilityRegistry {
  get(mode: ScaffoldedAdapterMode): ScaffoldedUniversityAdapter | undefined;
  getDescriptor(mode: ScaffoldedAdapterMode): AdapterCapabilityDescriptor | undefined;
  listDescriptors(): AdapterCapabilityDescriptor[];
  listModes(): ScaffoldedAdapterMode[];
  toAdapters(): UniversityAdapter[];
}

function cloneVerificationHook(hook: VerificationHookV1): VerificationHookV1 {
  return {
    ...hook,
  };
}

function cloneDescriptor(
  descriptor: AdapterCapabilityDescriptor,
): AdapterCapabilityDescriptor {
  return {
    ...descriptor,
    verificationKinds: [...descriptor.verificationKinds],
    assumptions: [...descriptor.assumptions],
  };
}

function createPreparedPayload(input: {
  application: CanonicalApplicationV1;
  decision: DecisionRecordV1;
  overlay: UniversityMappingOverlayV1;
  job: {
    jobId: string;
    idempotencyKey: string;
    attempts: Array<{ attemptNumber: number }>;
  };
  executionMetadata: Record<string, string>;
  verificationHooks: VerificationHookV1[];
}): PreparedProvisioningPayload {
  return {
    envelopeId: `${input.job.jobId}-attempt-${input.job.attempts.length + 1}`,
    jobId: input.job.jobId,
    applicationId: input.application.applicationId,
    decisionId: input.decision.decisionId,
    adapterMode: input.overlay.capabilityProfile.transportMode,
    idempotencyKey: input.job.idempotencyKey,
    fieldCount: input.overlay.fieldMappings.length,
    documentCount: input.application.documents.length,
    executionMetadata: { ...input.executionMetadata },
    verificationHooks: input.verificationHooks.map((hook) =>
      cloneVerificationHook(hook),
    ),
  };
}

export class InMemoryAdapterCapabilityRegistry
  implements AdapterCapabilityRegistry
{
  private readonly adapters = new Map<
    ScaffoldedAdapterMode,
    ScaffoldedUniversityAdapter
  >();

  constructor(adapters: ScaffoldedUniversityAdapter[]) {
    adapters.forEach((adapter) => {
      this.adapters.set(adapter.mode as ScaffoldedAdapterMode, adapter);
    });
  }

  get(mode: ScaffoldedAdapterMode): ScaffoldedUniversityAdapter | undefined {
    return this.adapters.get(mode);
  }

  getDescriptor(mode: ScaffoldedAdapterMode): AdapterCapabilityDescriptor | undefined {
    const adapter = this.get(mode);
    return adapter ? cloneDescriptor(adapter.descriptor) : undefined;
  }

  listDescriptors(): AdapterCapabilityDescriptor[] {
    return Array.from(this.adapters.values()).map((adapter) =>
      cloneDescriptor(adapter.descriptor),
    );
  }

  listModes(): ScaffoldedAdapterMode[] {
    return Array.from(this.adapters.keys());
  }

  toAdapters(): UniversityAdapter[] {
    return Array.from(this.adapters.values());
  }
}

export interface ImportWorkflowAdapterOptions {
  workflowId?: string;
  dropLocation?: string;
  statusTarget?: string;
  receiptTarget?: string;
  submittedAt?: string;
  verifiedAt?: string;
  reconciledAt?: string;
}

export interface EdgeConnectorAdapterOptions {
  connectorId?: string;
  endpointRef?: string;
  ackTarget?: string;
  recordLookupTarget?: string;
  submittedAt?: string;
  verifiedAt?: string;
  reconciledAt?: string;
}

export function createImportWorkflowAdapter(
  options: ImportWorkflowAdapterOptions = {},
): ScaffoldedUniversityAdapter {
  const workflowId = options.workflowId ?? "managed-import-runner";
  const dropLocation =
    options.dropLocation ?? `s3://managed-import/${workflowId}`;
  const statusTarget = options.statusTarget ?? `${workflowId}/status`;
  const receiptTarget =
    options.receiptTarget ?? `${dropLocation}/receipts/${workflowId}`;
  const verificationHooks: VerificationHookV1[] = [
    {
      kind: "batch-status-poll",
      target: statusTarget,
      intervalMinutes: 5,
      timeoutMinutes: 60,
    },
    {
      kind: "delivery-receipt",
      target: receiptTarget,
      intervalMinutes: 5,
      timeoutMinutes: 60,
    },
  ];
  const descriptor: AdapterCapabilityDescriptor = {
    mode: "import-workflow",
    dispatchChannel: "managed-import",
    deploymentBoundary: "partner-import-runner",
    credentialBoundary: "partner-managed",
    requiresPrivateNetwork: false,
    verificationKinds: verificationHooks.map((hook) => hook.kind),
    assumptions: [
      "Partner-side import runners consume manifests from a shared drop location.",
      "Credentials for import execution stay within the partner workflow boundary.",
    ],
  };

  return {
    mode: "import-workflow",
    routingProfile: {
      routeKey: `import-workflow:${workflowId}`,
      priority: 20,
      supportedManifestFormats: ["xml"],
      supportsInlineDocuments: true,
      supportedDuplicateCheckStrategies: ["email-and-course"],
    },
    failureTaxonomy: {
      codeFailureClasses: {
        invalid_credentials: "authorization",
        invalid_payload: "data_quality",
        duplicate_record: "duplicate_record",
      },
      terminalCodes: ["invalid_credentials", "invalid_payload", "duplicate_record"],
    },
    descriptor,
    prepare: ({ application, decision, overlay, job }) =>
      createPreparedPayload({
        application,
        decision,
        overlay,
        job,
        executionMetadata: {
          dispatchChannel: descriptor.dispatchChannel,
          dispatchTarget: dropLocation,
          workflowId,
          deploymentBoundary: descriptor.deploymentBoundary,
          credentialBoundary: descriptor.credentialBoundary,
          requiresPrivateNetwork: String(descriptor.requiresPrivateNetwork),
          manifestFormat: overlay.capabilityProfile.manifestFormat,
          acceptsDocumentsInline: String(
            overlay.capabilityProfile.acceptsDocumentsInline,
          ),
          duplicateCheckStrategy:
            overlay.capabilityProfile.duplicateCheckStrategy,
        },
        verificationHooks,
      }),
    execute: (_prepared, context) => ({
      accepted: true,
      externalReference: `import:${workflowId}:${context.idempotencyKey}`,
      submittedAt: options.submittedAt ?? "2026-03-10T16:01:00Z",
    }),
    verify: (prepared, execution) => ({
      verified: Boolean(prepared.verificationHooks?.length),
      verifiedAt: options.verifiedAt ?? "2026-03-10T16:02:00Z",
      externalReference: execution.externalReference,
    }),
    reconcile: () => ({
      status: "matched",
      reconciledAt: options.reconciledAt ?? "2026-03-10T16:03:00Z",
    }),
  };
}

export function createEdgeConnectorAdapter(
  options: EdgeConnectorAdapterOptions = {},
): ScaffoldedUniversityAdapter {
  const connectorId = options.connectorId ?? "edge-connector-01";
  const endpointRef =
    options.endpointRef ?? `edge://${connectorId}/private-network`;
  const ackTarget = options.ackTarget ?? `${endpointRef}/acks`;
  const recordLookupTarget =
    options.recordLookupTarget ?? `${endpointRef}/records`;
  const verificationHooks: VerificationHookV1[] = [
    {
      kind: "edge-ack",
      target: ackTarget,
      intervalMinutes: 2,
      timeoutMinutes: 30,
    },
    {
      kind: "record-lookup",
      target: recordLookupTarget,
      intervalMinutes: 10,
      timeoutMinutes: 90,
    },
  ];
  const descriptor: AdapterCapabilityDescriptor = {
    mode: "edge",
    dispatchChannel: "edge-connector",
    deploymentBoundary: "private-edge-node",
    credentialBoundary: "edge-local",
    requiresPrivateNetwork: true,
    verificationKinds: verificationHooks.map((hook) => hook.kind),
    assumptions: [
      "A connector runs inside the partner network boundary and owns last-mile delivery.",
      "Secrets remain local to the edge runtime and are not replayed from the control plane.",
    ],
  };

  return {
    mode: "edge",
    routingProfile: {
      routeKey: `edge:${connectorId}`,
      priority: 20,
      supportedManifestFormats: ["json"],
      supportsInlineDocuments: false,
      supportedDuplicateCheckStrategies: ["source-application-id"],
    },
    failureTaxonomy: {
      codeFailureClasses: {
        invalid_credentials: "authorization",
        configuration_error: "configuration",
        network_unreachable: "connectivity",
      },
      terminalCodes: ["invalid_credentials", "configuration_error"],
    },
    descriptor,
    prepare: ({ application, decision, overlay, job }) =>
      createPreparedPayload({
        application,
        decision,
        overlay,
        job,
        executionMetadata: {
          dispatchChannel: descriptor.dispatchChannel,
          dispatchTarget: endpointRef,
          connectorId,
          deploymentBoundary: descriptor.deploymentBoundary,
          credentialBoundary: descriptor.credentialBoundary,
          requiresPrivateNetwork: String(descriptor.requiresPrivateNetwork),
          manifestFormat: overlay.capabilityProfile.manifestFormat,
          acceptsDocumentsInline: String(
            overlay.capabilityProfile.acceptsDocumentsInline,
          ),
          duplicateCheckStrategy:
            overlay.capabilityProfile.duplicateCheckStrategy,
        },
        verificationHooks,
      }),
    execute: (_prepared, context) => ({
      accepted: true,
      externalReference: `edge:${connectorId}:${context.idempotencyKey}`,
      submittedAt: options.submittedAt ?? "2026-03-10T16:10:00Z",
    }),
    verify: (prepared, execution) => ({
      verified: Boolean(prepared.verificationHooks?.length),
      verifiedAt: options.verifiedAt ?? "2026-03-10T16:11:00Z",
      externalReference: execution.externalReference,
    }),
    reconcile: () => ({
      status: "matched",
      reconciledAt: options.reconciledAt ?? "2026-03-10T16:12:00Z",
    }),
  };
}

export function createScaffoldedAdapterRegistry(
  adapters: ScaffoldedUniversityAdapter[] = [
    createImportWorkflowAdapter(),
    createEdgeConnectorAdapter(),
  ],
): AdapterCapabilityRegistry {
  return new InMemoryAdapterCapabilityRegistry(adapters);
}
