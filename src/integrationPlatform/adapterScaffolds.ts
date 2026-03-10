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
  ProvisioningFailureClass,
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

export type EdgeConnectorAvailabilityStatus =
  | "healthy"
  | "degraded"
  | "offline";

export type EdgeConnectorRunStage =
  | "prepared"
  | "dispatched"
  | "verified"
  | "reconciled";

export type EdgeConnectorRunState =
  | "in_progress"
  | "completed"
  | "exception";

export type EdgeConnectorSecretScope =
  | "dispatch"
  | "edge-ack"
  | "record-lookup";

export type EdgeConnectorSecretRotationStatus =
  | "healthy"
  | "due_soon"
  | "overdue";

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

export interface EdgeConnectorHealthSnapshot {
  connectorId: string;
  routeKey: string;
  endpointRef: string;
  observedAt: string;
  availabilityStatus: EdgeConnectorAvailabilityStatus;
  details: string;
  deploymentBoundary: DeploymentBoundary;
  credentialBoundary: CredentialBoundary;
  requiresPrivateNetwork: boolean;
}

export interface EdgeConnectorRunTelemetryEvent {
  eventId: string;
  connectorId: string;
  routeKey: string;
  endpointRef: string;
  jobId: string;
  correlationId: string;
  observedAt: string;
  stage: EdgeConnectorRunStage;
  runState: EdgeConnectorRunState;
  availabilityStatus: EdgeConnectorAvailabilityStatus;
  details: string;
  externalReference?: string;
}

export interface EdgeConnectorStatusView {
  connectorId: string;
  routeKey: string;
  endpointRef: string;
  availabilityStatus: EdgeConnectorAvailabilityStatus;
  availabilityDetails: string;
  lastHealthObservedAt?: string;
  latestRunStage?: EdgeConnectorRunStage;
  latestRunState?: EdgeConnectorRunState;
  lastRunObservedAt?: string;
  latestJobId?: string;
  latestCorrelationId?: string;
  requiresPrivateNetwork: boolean;
}

export interface EdgeConnectorScopedSecret {
  connectorId: string;
  scope: EdgeConnectorSecretScope;
  credentialBoundary: CredentialBoundary;
  secretId: string;
  secretVersion: string;
  value: string;
  lastRotatedAt: string;
  nextRotationDueAt?: string;
}

export interface EdgeConnectorSecretAccessRequest {
  connectorId: string;
  scope: EdgeConnectorSecretScope;
  credentialBoundary: CredentialBoundary;
  routeKey: string;
  endpointRef: string;
}

export interface EdgeConnectorSecretProvider {
  getSecret(request: EdgeConnectorSecretAccessRequest): EdgeConnectorScopedSecret;
}

export type EdgeConnectorSecurityAuditEventType =
  | "secret.rotation.checked"
  | "secret.access.granted"
  | "secret.access.blocked";

export interface EdgeConnectorSecurityAuditEvent {
  eventId: string;
  connectorId: string;
  routeKey: string;
  endpointRef: string;
  occurredAt: string;
  type: EdgeConnectorSecurityAuditEventType;
  scope: EdgeConnectorSecretScope;
  credentialBoundary: CredentialBoundary;
  jobId: string;
  correlationId: string;
  details: string;
  secretId?: string;
  secretVersion?: string;
  rotationStatus?: EdgeConnectorSecretRotationStatus;
}

export interface EdgeConnectorSecurityAuditFilters {
  connectorId?: string;
  jobId?: string;
  type?: EdgeConnectorSecurityAuditEventType;
  scope?: EdgeConnectorSecretScope;
}

export interface EdgeConnectorSecurityAuditStore {
  append(event: EdgeConnectorSecurityAuditEvent): void;
  list(filters?: EdgeConnectorSecurityAuditFilters): EdgeConnectorSecurityAuditEvent[];
}

export interface EdgeConnectorTelemetryFilters {
  connectorId?: string;
  jobId?: string;
  runState?: EdgeConnectorRunState;
}

export interface EdgeConnectorTelemetryStore {
  getLatestHealth(connectorId: string): EdgeConnectorHealthSnapshot | undefined;
  listConnectorStatuses(): EdgeConnectorStatusView[];
  listRunEvents(
    filters?: EdgeConnectorTelemetryFilters,
  ): EdgeConnectorRunTelemetryEvent[];
  recordHealth(snapshot: EdgeConnectorHealthSnapshot): void;
  recordRun(event: EdgeConnectorRunTelemetryEvent): void;
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

function cloneHealthSnapshot(
  snapshot: EdgeConnectorHealthSnapshot,
): EdgeConnectorHealthSnapshot {
  return {
    ...snapshot,
  };
}

function cloneRunTelemetryEvent(
  event: EdgeConnectorRunTelemetryEvent,
): EdgeConnectorRunTelemetryEvent {
  return {
    ...event,
  };
}

function cloneScopedSecret(
  secret: EdgeConnectorScopedSecret,
): EdgeConnectorScopedSecret {
  return {
    ...secret,
  };
}

function cloneSecurityAuditEvent(
  event: EdgeConnectorSecurityAuditEvent,
): EdgeConnectorSecurityAuditEvent {
  return {
    ...event,
  };
}

function sanitizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export class InMemoryEdgeConnectorTelemetryStore
  implements EdgeConnectorTelemetryStore
{
  private readonly latestHealthByConnector = new Map<
    string,
    EdgeConnectorHealthSnapshot
  >();
  private readonly runEvents: EdgeConnectorRunTelemetryEvent[] = [];

  getLatestHealth(connectorId: string): EdgeConnectorHealthSnapshot | undefined {
    const snapshot = this.latestHealthByConnector.get(connectorId);
    return snapshot ? cloneHealthSnapshot(snapshot) : undefined;
  }

  listConnectorStatuses(): EdgeConnectorStatusView[] {
    const connectorIds = new Set<string>([
      ...this.latestHealthByConnector.keys(),
      ...this.runEvents.map((event) => event.connectorId),
    ]);

    return Array.from(connectorIds)
      .flatMap((connectorId) => {
        const latestHealth = this.latestHealthByConnector.get(connectorId);
        const latestRun = [...this.runEvents]
          .filter((event) => event.connectorId === connectorId)
          .sort((left, right) => right.observedAt.localeCompare(left.observedAt))[0];

        if (!latestHealth && !latestRun) {
          return [];
        }

        return [{
          connectorId,
          routeKey: latestHealth?.routeKey ?? latestRun?.routeKey ?? `edge:${connectorId}`,
          endpointRef: latestHealth?.endpointRef ?? latestRun?.endpointRef ?? "",
          availabilityStatus: latestHealth?.availabilityStatus ?? "degraded",
          availabilityDetails:
            latestHealth?.details ?? "No connector health snapshot has been recorded.",
          lastHealthObservedAt: latestHealth?.observedAt,
          latestRunStage: latestRun?.stage,
          latestRunState: latestRun?.runState,
          lastRunObservedAt: latestRun?.observedAt,
          latestJobId: latestRun?.jobId,
          latestCorrelationId: latestRun?.correlationId,
          requiresPrivateNetwork: latestHealth?.requiresPrivateNetwork ?? true,
        } satisfies EdgeConnectorStatusView];
      })
      .sort((left, right) => left.connectorId.localeCompare(right.connectorId));
  }

  listRunEvents(
    filters: EdgeConnectorTelemetryFilters = {},
  ): EdgeConnectorRunTelemetryEvent[] {
    return this.runEvents
      .filter((event) =>
        filters.connectorId ? event.connectorId === filters.connectorId : true,
      )
      .filter((event) => (filters.jobId ? event.jobId === filters.jobId : true))
      .filter((event) =>
        filters.runState ? event.runState === filters.runState : true,
      )
      .sort((left, right) => left.observedAt.localeCompare(right.observedAt))
      .map((event) => cloneRunTelemetryEvent(event));
  }

  recordHealth(snapshot: EdgeConnectorHealthSnapshot): void {
    this.latestHealthByConnector.set(
      snapshot.connectorId,
      cloneHealthSnapshot(snapshot),
    );
  }

  recordRun(event: EdgeConnectorRunTelemetryEvent): void {
    this.runEvents.push(cloneRunTelemetryEvent(event));
  }
}

export class InMemoryEdgeConnectorSecretProvider
  implements EdgeConnectorSecretProvider
{
  private readonly secrets = new Map<string, EdgeConnectorScopedSecret>();

  constructor(secrets: EdgeConnectorScopedSecret[]) {
    secrets.forEach((secret) => {
      this.secrets.set(
        [
          secret.connectorId,
          secret.scope,
          secret.credentialBoundary,
        ].join(":"),
        cloneScopedSecret(secret),
      );
    });
  }

  getSecret(request: EdgeConnectorSecretAccessRequest): EdgeConnectorScopedSecret {
    const secret = this.secrets.get(
      [request.connectorId, request.scope, request.credentialBoundary].join(":"),
    );
    if (!secret) {
      throw new Error(
        `No scoped secret registered for ${request.connectorId} ${request.scope} ${request.credentialBoundary}.`,
      );
    }

    return cloneScopedSecret(secret);
  }
}

export class InMemoryEdgeConnectorSecurityAuditStore
  implements EdgeConnectorSecurityAuditStore
{
  private readonly events: EdgeConnectorSecurityAuditEvent[] = [];

  append(event: EdgeConnectorSecurityAuditEvent): void {
    this.events.push(cloneSecurityAuditEvent(event));
  }

  list(
    filters: EdgeConnectorSecurityAuditFilters = {},
  ): EdgeConnectorSecurityAuditEvent[] {
    return this.events
      .filter((event) =>
        filters.connectorId ? event.connectorId === filters.connectorId : true,
      )
      .filter((event) => (filters.jobId ? event.jobId === filters.jobId : true))
      .filter((event) => (filters.type ? event.type === filters.type : true))
      .filter((event) => (filters.scope ? event.scope === filters.scope : true))
      .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))
      .map((event) => cloneSecurityAuditEvent(event));
  }
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
  preparedAt?: string;
  submittedAt?: string;
  verifiedAt?: string;
  reconciledAt?: string;
  telemetryStore?: EdgeConnectorTelemetryStore;
  healthStatus?: EdgeConnectorAvailabilityStatus;
  healthDetails?: string;
  executionErrorCode?: string;
  executionErrorMessage?: string;
  executionErrorRetryable?: boolean;
  executionErrorFailureClass?: ProvisioningFailureClass;
  secretProvider?: EdgeConnectorSecretProvider;
  securityAuditStore?: EdgeConnectorSecurityAuditStore;
  secretRotationWarningDays?: number;
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
  const routeKey = `edge:${connectorId}`;
  const ackTarget = options.ackTarget ?? `${endpointRef}/acks`;
  const recordLookupTarget =
    options.recordLookupTarget ?? `${endpointRef}/records`;
  const telemetryStore = options.telemetryStore;
  const securityAuditStore = options.securityAuditStore;
  const secretProvider =
    options.secretProvider ??
    new InMemoryEdgeConnectorSecretProvider([
      {
        connectorId,
        scope: "dispatch",
        credentialBoundary: "edge-local",
        secretId: `${connectorId}-dispatch-secret`,
        secretVersion: "v1",
        value: `dispatch-token-${connectorId}`,
        lastRotatedAt: "2026-03-01T00:00:00Z",
        nextRotationDueAt: "2026-04-01T00:00:00Z",
      },
      {
        connectorId,
        scope: "edge-ack",
        credentialBoundary: "edge-local",
        secretId: `${connectorId}-ack-secret`,
        secretVersion: "v1",
        value: `ack-token-${connectorId}`,
        lastRotatedAt: "2026-03-01T00:00:00Z",
        nextRotationDueAt: "2026-04-01T00:00:00Z",
      },
      {
        connectorId,
        scope: "record-lookup",
        credentialBoundary: "edge-local",
        secretId: `${connectorId}-lookup-secret`,
        secretVersion: "v1",
        value: `lookup-token-${connectorId}`,
        lastRotatedAt: "2026-03-01T00:00:00Z",
        nextRotationDueAt: "2026-04-01T00:00:00Z",
      },
    ]);
  const secretRotationWarningDays = options.secretRotationWarningDays ?? 7;
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

  function appendSecurityAudit(input: {
    occurredAt: string;
    type: EdgeConnectorSecurityAuditEventType;
    scope: EdgeConnectorSecretScope;
    jobId: string;
    correlationId: string;
    details: string;
    secretId?: string;
    secretVersion?: string;
    rotationStatus?: EdgeConnectorSecretRotationStatus;
  }): void {
    if (!securityAuditStore) {
      return;
    }

    securityAuditStore.append({
      eventId: [
        "edge-security",
        sanitizeToken(connectorId),
        sanitizeToken(input.jobId),
        sanitizeToken(input.type),
        sanitizeToken(input.scope),
        sanitizeToken(input.occurredAt),
      ].join("-"),
      connectorId,
      routeKey,
      endpointRef,
      occurredAt: input.occurredAt,
      type: input.type,
      scope: input.scope,
      credentialBoundary: descriptor.credentialBoundary,
      jobId: input.jobId,
      correlationId: input.correlationId,
      details: input.details,
      secretId: input.secretId,
      secretVersion: input.secretVersion,
      rotationStatus: input.rotationStatus,
    });
  }

  function classifyRotationStatus(
    observedAt: string,
    nextRotationDueAt?: string,
  ): EdgeConnectorSecretRotationStatus {
    if (!nextRotationDueAt) {
      return "healthy";
    }

    const dueAt = Date.parse(nextRotationDueAt);
    const now = Date.parse(observedAt);
    if (Number.isNaN(dueAt) || Number.isNaN(now)) {
      return "healthy";
    }

    if (now >= dueAt) {
      return "overdue";
    }

    const warningWindowMs = secretRotationWarningDays * 24 * 60 * 60 * 1000;
    if (dueAt - now <= warningWindowMs) {
      return "due_soon";
    }

    return "healthy";
  }

  function resolveScopedSecret(input: {
    scope: EdgeConnectorSecretScope;
    observedAt: string;
    jobId: string;
    correlationId: string;
  }): EdgeConnectorScopedSecret {
    let secret: EdgeConnectorScopedSecret;
    try {
      secret = secretProvider.getSecret({
        connectorId,
        scope: input.scope,
        credentialBoundary: descriptor.credentialBoundary,
        routeKey,
        endpointRef,
      });
    } catch (error) {
      appendSecurityAudit({
        occurredAt: input.observedAt,
        type: "secret.access.blocked",
        scope: input.scope,
        jobId: input.jobId,
        correlationId: input.correlationId,
        details:
          error instanceof Error
            ? error.message
            : "Secret provider did not return a scoped connector secret.",
      });
      throw new AdapterExecutionErrorClass(
        "configuration_error",
        "Secret provider did not return a scoped connector secret.",
        {
          retryable: false,
          failureClass: "configuration",
        },
      );
    }

    if (
      secret.connectorId !== connectorId ||
      secret.scope !== input.scope ||
      secret.credentialBoundary !== descriptor.credentialBoundary ||
      !secret.value.trim()
    ) {
      appendSecurityAudit({
        occurredAt: input.observedAt,
        type: "secret.access.blocked",
        scope: input.scope,
        jobId: input.jobId,
        correlationId: input.correlationId,
        details:
          "Connector secret did not satisfy the required connector, scope, boundary, or non-empty value constraints.",
        secretId: secret.secretId,
        secretVersion: secret.secretVersion,
      });
      throw new AdapterExecutionErrorClass(
        "configuration_error",
        "Connector secret failed scoped boundary validation.",
        {
          retryable: false,
          failureClass: "configuration",
        },
      );
    }

    const rotationStatus = classifyRotationStatus(
      input.observedAt,
      secret.nextRotationDueAt,
    );
    appendSecurityAudit({
      occurredAt: input.observedAt,
      type: "secret.rotation.checked",
      scope: input.scope,
      jobId: input.jobId,
      correlationId: input.correlationId,
      details:
        rotationStatus === "healthy"
          ? "Secret rotation window is healthy."
          : rotationStatus === "due_soon"
            ? "Secret rotation window is approaching its due date."
            : "Secret rotation window has expired and the secret is blocked from use.",
      secretId: secret.secretId,
      secretVersion: secret.secretVersion,
      rotationStatus,
    });

    if (rotationStatus === "overdue") {
      appendSecurityAudit({
        occurredAt: input.observedAt,
        type: "secret.access.blocked",
        scope: input.scope,
        jobId: input.jobId,
        correlationId: input.correlationId,
        details: "Connector secret rotation is overdue and the secret cannot be used.",
        secretId: secret.secretId,
        secretVersion: secret.secretVersion,
        rotationStatus,
      });
      throw new AdapterExecutionErrorClass(
        "invalid_credentials",
        "Connector secret rotation is overdue and access has been blocked.",
        {
          retryable: false,
          failureClass: "authorization",
        },
      );
    }

    appendSecurityAudit({
      occurredAt: input.observedAt,
      type: "secret.access.granted",
      scope: input.scope,
      jobId: input.jobId,
      correlationId: input.correlationId,
      details: "Connector secret access was granted through the mediated provider.",
      secretId: secret.secretId,
      secretVersion: secret.secretVersion,
      rotationStatus,
    });

    return secret;
  }

  function resolveAvailabilityStatus(
    failureClass?: ProvisioningFailureClass,
  ): EdgeConnectorAvailabilityStatus {
    if (options.healthStatus) {
      return options.healthStatus;
    }

    if (failureClass === "connectivity") {
      return "offline";
    }

    if (failureClass) {
      return "degraded";
    }

    return "healthy";
  }

  function resolveAvailabilityDetails(
    availabilityStatus: EdgeConnectorAvailabilityStatus,
    detailOverride?: string,
  ): string {
    if (detailOverride) {
      return detailOverride;
    }

    if (options.healthDetails) {
      return options.healthDetails;
    }

    if (availabilityStatus === "healthy") {
      return "Connector heartbeat and dispatch checks are within the expected SLA.";
    }

    if (availabilityStatus === "offline") {
      return "Connector heartbeat is unavailable from the private-network edge runtime.";
    }

    return "Connector is reachable but reporting degraded runtime health.";
  }

  function recordHealth(input: {
    observedAt: string;
    failureClass?: ProvisioningFailureClass;
    details?: string;
  }): void {
    if (!telemetryStore) {
      return;
    }

    const availabilityStatus = resolveAvailabilityStatus(input.failureClass);
    telemetryStore.recordHealth({
      connectorId,
      routeKey,
      endpointRef,
      observedAt: input.observedAt,
      availabilityStatus,
      details: resolveAvailabilityDetails(availabilityStatus, input.details),
      deploymentBoundary: descriptor.deploymentBoundary,
      credentialBoundary: descriptor.credentialBoundary,
      requiresPrivateNetwork: descriptor.requiresPrivateNetwork,
    });
  }

  function recordRun(input: {
    observedAt: string;
    stage: EdgeConnectorRunStage;
    runState: EdgeConnectorRunState;
    jobId: string;
    correlationId: string;
    externalReference?: string;
    failureClass?: ProvisioningFailureClass;
    details: string;
  }): void {
    if (!telemetryStore) {
      return;
    }

    const availabilityStatus = resolveAvailabilityStatus(input.failureClass);
    telemetryStore.recordRun({
      eventId: [
        "edge-run",
        sanitizeToken(connectorId),
        sanitizeToken(input.jobId),
        sanitizeToken(input.stage),
      ].join("-"),
      connectorId,
      routeKey,
      endpointRef,
      jobId: input.jobId,
      correlationId: input.correlationId,
      observedAt: input.observedAt,
      stage: input.stage,
      runState: input.runState,
      availabilityStatus,
      details: input.details,
      externalReference: input.externalReference,
    });
  }

  return {
    mode: "edge",
    routingProfile: {
      routeKey,
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
    prepare: ({ application, decision, overlay, job }) => {
      const preparedAt = options.preparedAt ?? "2026-03-10T16:09:00Z";
      recordHealth({
        observedAt: preparedAt,
      });
      recordRun({
        observedAt: preparedAt,
        stage: "prepared",
        runState: "in_progress",
        jobId: job.jobId,
        correlationId: job.correlationId,
        details: "Prepared edge connector dispatch payload and verification hooks.",
      });

      return createPreparedPayload({
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
          credentialBoundaryPolicy: "edge-local-only",
          secretAccessMode: "provider-mediated",
          dispatchCredentialScope: "dispatch",
          verificationCredentialScope: "edge-ack",
          reconciliationCredentialScope: "record-lookup",
          requiresPrivateNetwork: String(descriptor.requiresPrivateNetwork),
          routeKey,
          ackTarget,
          recordLookupTarget,
          connectorAvailabilityStatus: resolveAvailabilityStatus(),
          manifestFormat: overlay.capabilityProfile.manifestFormat,
          acceptsDocumentsInline: String(
            overlay.capabilityProfile.acceptsDocumentsInline,
          ),
          duplicateCheckStrategy:
            overlay.capabilityProfile.duplicateCheckStrategy,
        },
        verificationHooks,
      });
    },
    execute: (_prepared, context) => {
      const submittedAt = options.submittedAt ?? "2026-03-10T16:10:00Z";
      const dispatchSecret = resolveScopedSecret({
        scope: "dispatch",
        observedAt: submittedAt,
        jobId: context.jobId,
        correlationId: context.correlationId,
      });
      if (options.executionErrorCode) {
        recordHealth({
          observedAt: submittedAt,
          failureClass: options.executionErrorFailureClass,
          details: options.executionErrorMessage,
        });
        recordRun({
          observedAt: submittedAt,
          stage: "dispatched",
          runState: "exception",
          jobId: context.jobId,
          correlationId: context.correlationId,
          failureClass: options.executionErrorFailureClass,
          details:
            options.executionErrorMessage ??
            `Edge dispatch failed with ${options.executionErrorCode}.`,
        });
        throw new AdapterExecutionErrorClass(
          options.executionErrorCode,
          options.executionErrorMessage ??
            `Edge dispatch failed with ${options.executionErrorCode}.`,
          {
            retryable: options.executionErrorRetryable,
            failureClass: options.executionErrorFailureClass,
          },
        );
      }

      const externalReference = `edge:${connectorId}:${context.idempotencyKey}`;
      recordHealth({
        observedAt: submittedAt,
      });
      recordRun({
        observedAt: submittedAt,
        stage: "dispatched",
        runState: "in_progress",
        jobId: context.jobId,
        correlationId: context.correlationId,
        externalReference,
        details:
          `Edge connector accepted dispatch for private-network execution using ${dispatchSecret.secretId} ${dispatchSecret.secretVersion}.`,
      });
      return {
        accepted: true,
        externalReference,
        submittedAt,
      };
    },
    verify: (prepared, execution, context) => {
      const verified = Boolean(prepared.verificationHooks?.length);
      const verifiedAt = options.verifiedAt ?? "2026-03-10T16:11:00Z";
      const verificationSecret = resolveScopedSecret({
        scope: "edge-ack",
        observedAt: verifiedAt,
        jobId: context.jobId,
        correlationId: context.correlationId,
      });
      recordHealth({
        observedAt: verifiedAt,
      });
      recordRun({
        observedAt: verifiedAt,
        stage: "verified",
        runState: verified ? "in_progress" : "exception",
        jobId: context.jobId,
        correlationId: context.correlationId,
        externalReference: execution.externalReference,
        failureClass: verified ? undefined : "verification",
        details: verified
          ? `Edge acknowledgement hooks were checked with ${verificationSecret.secretId} ${verificationSecret.secretVersion}.`
          : "Edge verification hooks were missing or incomplete.",
      });
      return {
        verified,
        verifiedAt,
        externalReference: execution.externalReference,
      };
    },
    reconcile: (_prepared, execution, context) => {
      const reconciledAt = options.reconciledAt ?? "2026-03-10T16:12:00Z";
      const lookupSecret = resolveScopedSecret({
        scope: "record-lookup",
        observedAt: reconciledAt,
        jobId: context.jobId,
        correlationId: context.correlationId,
      });
      recordHealth({
        observedAt: reconciledAt,
      });
      recordRun({
        observedAt: reconciledAt,
        stage: "reconciled",
        runState: "completed",
        jobId: context.jobId,
        correlationId: context.correlationId,
        externalReference: execution.externalReference,
        details:
          `Edge connector reconciliation confirmed the downstream record lookup with ${lookupSecret.secretId} ${lookupSecret.secretVersion}.`,
      });
      return {
        status: "matched",
        reconciledAt,
      };
    },
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
