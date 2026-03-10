import type {
  CanonicalApplicationV1,
  UniversityMappingOverlayV1,
} from "./contracts";
import {
  createImportWorkflowDispatchPayload,
  createImportWorkflowVerificationReceipt,
  mapImportWorkflowVerificationReceipt,
  validateImportWorkflowDispatchPayload,
  validateImportWorkflowVerificationReceipt,
  type ImportWorkflowVerificationStatus,
} from "./importWorkflowContracts";
import type {
  AdapterMode,
  DecisionRecordV1,
  PreparedProvisioningPayload,
  UniversityAdapter,
  VerificationHookKind,
  VerificationHookV1,
} from "./provisioning";
import { AdapterExecutionError as AdapterExecutionErrorClass } from "./provisioning";

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

function cloneJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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
  dispatchPayload?: unknown;
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
    dispatchPayload: input.dispatchPayload
      ? cloneJsonValue(input.dispatchPayload)
      : undefined,
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
  verificationStatus?: ImportWorkflowVerificationStatus;
  verificationReasonCode?: string;
  verificationDetails?: string;
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

  function buildVerificationReceipt(input: {
    prepared: PreparedProvisioningPayload;
    externalReference: string;
  }) {
    return createImportWorkflowVerificationReceipt({
      workflowId,
      jobId: input.prepared.jobId,
      envelopeId: input.prepared.envelopeId,
      idempotencyKey: input.prepared.idempotencyKey,
      externalReference: input.externalReference,
      receiptTarget,
      observedAt: options.verifiedAt ?? "2026-03-10T16:02:00Z",
      status: options.verificationStatus ?? "imported",
      reasonCode: options.verificationReasonCode,
      details: options.verificationDetails,
    });
  }

  function createInvalidPayloadError(
    errors: string[],
  ): AdapterExecutionErrorClass {
    return new AdapterExecutionErrorClass(
      "invalid_payload",
      errors.join(" "),
      {
        retryable: false,
        failureClass: "data_quality",
      },
    );
  }

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
    prepare: ({ application, decision, overlay, job }) => {
      const dispatchPayload = createImportWorkflowDispatchPayload({
        workflowId,
        dropLocation,
        statusTarget,
        receiptTarget,
        routeKey: job.routingDecision.routeKey,
        envelopeId: `${job.jobId}-attempt-${job.attempts.length + 1}`,
        jobId: job.jobId,
        idempotencyKey: job.idempotencyKey,
        decisionId: decision.decisionId,
        applicationId: application.applicationId,
        overlay,
        fieldCount: overlay.fieldMappings.length,
        documentCount: application.documents.length,
      });
      const validation = validateImportWorkflowDispatchPayload(dispatchPayload);

      if (!validation.valid) {
        throw createInvalidPayloadError(validation.errors);
      }

      return createPreparedPayload({
        application,
        decision,
        overlay,
        job,
        dispatchPayload,
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
          dispatchPayloadSchema: dispatchPayload.schema,
          dispatchPayloadVersion: dispatchPayload.schemaVersion,
          verificationReceiptSchema: "ImportWorkflowVerificationReceiptV1",
        },
        verificationHooks,
      });
    },
    execute: (_prepared, context) => ({
      accepted: true,
      externalReference: `import:${workflowId}:${context.idempotencyKey}`,
      submittedAt: options.submittedAt ?? "2026-03-10T16:01:00Z",
    }),
    verify: (prepared, execution) => {
      const receipt = buildVerificationReceipt({
        prepared,
        externalReference: execution.externalReference,
      });
      const validation = validateImportWorkflowVerificationReceipt(receipt);

      if (!validation.valid) {
        throw createInvalidPayloadError(validation.errors);
      }

      const outcome = mapImportWorkflowVerificationReceipt(receipt);
      if (outcome.kind === "error") {
        throw new AdapterExecutionErrorClass(
          outcome.errorCode ?? "partner_unavailable",
          outcome.errorMessage ?? "Import workflow receipt could not be mapped.",
          {
            retryable: outcome.retryable,
            failureClass: outcome.failureClass,
          },
        );
      }

      return {
        verified: true,
        verifiedAt: receipt.observedAt,
        externalReference: receipt.externalReference,
      };
    },
    reconcile: (prepared, execution) => {
      const receipt = buildVerificationReceipt({
        prepared,
        externalReference: execution.externalReference,
      });
      const validation = validateImportWorkflowVerificationReceipt(receipt);

      if (!validation.valid) {
        throw createInvalidPayloadError(validation.errors);
      }

      const outcome = mapImportWorkflowVerificationReceipt(receipt);
      return {
        status:
          outcome.kind === "verified"
            ? outcome.reconciliationStatus ?? "pending"
            : "exception",
        reconciledAt: options.reconciledAt ?? receipt.observedAt,
        details:
          receipt.details ??
          (outcome.kind === "verified"
            ? `Import workflow receipt reported ${receipt.status}.`
            : outcome.errorMessage),
      };
    },
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
