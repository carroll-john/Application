import type {
  CanonicalApplicationV1,
  SchemaVersion,
  UniversityCapabilityProfile,
  UniversityMappingOverlayV1,
} from "./contracts";
import { isBackwardCompatibleVersion } from "./contracts";
import {
  validateCanonicalApplication,
  validateUniversityMappingOverlay,
} from "./validation";

export const DECISION_RECORD_SCHEMA_VERSION = "1.0.0";
export const PROVISIONING_JOB_SCHEMA_VERSION = "1.0.0";

export type AdapterMode = UniversityCapabilityProfile["transportMode"];

export type DecisionOutcomeStatus =
  | "offer-made"
  | "conditional-offer"
  | "rejected"
  | "waitlisted";

export interface DecisionOutcome {
  status: DecisionOutcomeStatus;
  reasonCode?: string;
  notes?: string;
}

export interface DecisionRecordV1 {
  schema: "DecisionRecordV1";
  schemaVersion: SchemaVersion;
  compatibilityVersion: SchemaVersion;
  decisionId: string;
  applicationId: string;
  applicantId: string;
  partnerId: string;
  partnerName: string;
  decidedAt: string;
  decidedBy: string;
  correlationId: string;
  outcome: DecisionOutcome;
  metadata?: Record<string, string>;
}

export const decisionRecordSchemaDefaults: Pick<
  DecisionRecordV1,
  "schema" | "schemaVersion" | "compatibilityVersion"
> = {
  schema: "DecisionRecordV1",
  schemaVersion: DECISION_RECORD_SCHEMA_VERSION,
  compatibilityVersion: DECISION_RECORD_SCHEMA_VERSION,
};

export type ProvisioningJobStatus =
  | "pending"
  | "in_progress"
  | "retry_pending"
  | "completed"
  | "failed";

export type ProvisioningAttemptOutcome =
  | "succeeded"
  | "retryable_error"
  | "failed";

export type ProvisioningFailureClass =
  | "connectivity"
  | "rate_limit"
  | "partner_system"
  | "verification"
  | "reconciliation"
  | "data_quality"
  | "duplicate_record"
  | "authorization"
  | "configuration"
  | "unexpected";

export type FailureDisposition = "retry" | "terminal";

export interface ProvisioningAttemptV1 {
  attemptNumber: number;
  startedAt: string;
  completedAt: string;
  outcome: ProvisioningAttemptOutcome;
  externalReference?: string;
  errorCode?: string;
  errorMessage?: string;
  failureClass?: ProvisioningFailureClass;
  failureDisposition?: FailureDisposition;
  retryDelayMinutes?: number;
  retryScheduledAt?: string;
}

export type ProvisioningJobTransitionOrigin = ProvisioningJobStatus | "none";

export interface ProvisioningJobTransitionV1 {
  transitionId: string;
  fromStatus: ProvisioningJobTransitionOrigin;
  toStatus: ProvisioningJobStatus;
  transitionedAt: string;
  reason: string;
  metadata?: Record<string, string>;
}

export interface ProvisioningRoutingDecisionV1 {
  routeKey: string;
  selectedAt: string;
  priority: number;
  reason: string;
  capabilitySnapshot: {
    transportMode: AdapterMode;
    manifestFormat: UniversityCapabilityProfile["manifestFormat"];
    acceptsDocumentsInline: string;
    duplicateCheckStrategy: UniversityCapabilityProfile["duplicateCheckStrategy"];
  };
}

export interface ProvisioningJobV1 {
  schema: "ProvisioningJobV1";
  schemaVersion: SchemaVersion;
  compatibilityVersion: SchemaVersion;
  jobId: string;
  idempotencyKey: string;
  decisionId: string;
  applicationId: string;
  applicantId: string;
  partnerId: string;
  partnerName: string;
  correlationId: string;
  adapterMode: AdapterMode;
  routingDecision: ProvisioningRoutingDecisionV1;
  status: ProvisioningJobStatus;
  createdAt: string;
  updatedAt: string;
  maxAttempts: number;
  attempts: ProvisioningAttemptV1[];
  transitionHistory: ProvisioningJobTransitionV1[];
  nextRetryAt?: string;
  lastErrorCode?: string;
  terminalFailureCode?: string;
  terminalFailureClass?: ProvisioningFailureClass;
  targetRecordRef?: string;
}

export const provisioningJobSchemaDefaults: Pick<
  ProvisioningJobV1,
  "schema" | "schemaVersion" | "compatibilityVersion"
> = {
  schema: "ProvisioningJobV1",
  schemaVersion: PROVISIONING_JOB_SCHEMA_VERSION,
  compatibilityVersion: PROVISIONING_JOB_SCHEMA_VERSION,
};

export type VerificationHookKind =
  | "batch-status-poll"
  | "delivery-receipt"
  | "edge-ack"
  | "record-lookup";

export interface VerificationHookV1 {
  kind: VerificationHookKind;
  target: string;
  intervalMinutes: number;
  timeoutMinutes: number;
}

export interface PreparedProvisioningPayload {
  envelopeId: string;
  jobId: string;
  applicationId: string;
  decisionId: string;
  adapterMode: AdapterMode;
  idempotencyKey: string;
  fieldCount: number;
  documentCount: number;
  executionMetadata?: Record<string, string>;
  verificationHooks?: VerificationHookV1[];
}

export interface AdapterContext {
  jobId: string;
  correlationId: string;
  idempotencyKey: string;
  attemptNumber: number;
}

export interface AdapterExecutionResult {
  accepted: boolean;
  externalReference: string;
  submittedAt: string;
}

export interface AdapterVerificationResult {
  verified: boolean;
  verifiedAt: string;
  externalReference: string;
}

export interface AdapterReconciliationResult {
  status: "matched" | "pending" | "exception";
  reconciledAt: string;
  details?: string;
}

export interface AdapterRoutingProfile {
  routeKey: string;
  priority?: number;
  supportedManifestFormats?: UniversityCapabilityProfile["manifestFormat"][];
  supportsInlineDocuments?: boolean;
  supportedDuplicateCheckStrategies?: UniversityCapabilityProfile["duplicateCheckStrategy"][];
}

export interface AdapterFailureTaxonomy {
  codeFailureClasses?: Partial<Record<string, ProvisioningFailureClass>>;
  terminalCodes?: string[];
}

export interface UniversityAdapter {
  mode: AdapterMode;
  routingProfile?: AdapterRoutingProfile;
  failureTaxonomy?: AdapterFailureTaxonomy;
  prepare(input: {
    application: CanonicalApplicationV1;
    decision: DecisionRecordV1;
    overlay: UniversityMappingOverlayV1;
    job: ProvisioningJobV1;
  }): PreparedProvisioningPayload | Promise<PreparedProvisioningPayload>;
  execute(
    prepared: PreparedProvisioningPayload,
    context: AdapterContext,
  ): AdapterExecutionResult | Promise<AdapterExecutionResult>;
  verify(
    prepared: PreparedProvisioningPayload,
    execution: AdapterExecutionResult,
    context: AdapterContext,
  ): AdapterVerificationResult | Promise<AdapterVerificationResult>;
  reconcile(
    prepared: PreparedProvisioningPayload,
    verification: AdapterVerificationResult,
    context: AdapterContext,
  ): AdapterReconciliationResult | Promise<AdapterReconciliationResult>;
}

export interface ProvisioningJobStore {
  getByIdempotencyKey(idempotencyKey: string): ProvisioningJobV1 | undefined;
  listByStatus(status: ProvisioningJobStatus): ProvisioningJobV1[];
  save(job: ProvisioningJobV1): void;
}

function cloneProvisioningTransition(
  transition: ProvisioningJobTransitionV1,
): ProvisioningJobTransitionV1 {
  return {
    ...transition,
    metadata: transition.metadata ? { ...transition.metadata } : undefined,
  };
}

function cloneProvisioningRoutingDecision(
  decision: ProvisioningRoutingDecisionV1,
): ProvisioningRoutingDecisionV1 {
  return {
    ...decision,
    capabilitySnapshot: {
      ...decision.capabilitySnapshot,
    },
  };
}

function cloneProvisioningJob(job: ProvisioningJobV1): ProvisioningJobV1 {
  return {
    ...job,
    routingDecision: cloneProvisioningRoutingDecision(job.routingDecision),
    attempts: job.attempts.map((attempt) => ({ ...attempt })),
    transitionHistory: job.transitionHistory.map((transition) =>
      cloneProvisioningTransition(transition),
    ),
  };
}

export class InMemoryProvisioningJobStore implements ProvisioningJobStore {
  private readonly jobs = new Map<string, ProvisioningJobV1>();

  getByIdempotencyKey(idempotencyKey: string): ProvisioningJobV1 | undefined {
    const job = this.jobs.get(idempotencyKey);
    return job ? cloneProvisioningJob(job) : undefined;
  }

  listByStatus(status: ProvisioningJobStatus): ProvisioningJobV1[] {
    return Array.from(this.jobs.values())
      .filter((job) => job.status === status)
      .map((job) => cloneProvisioningJob(job));
  }

  save(job: ProvisioningJobV1): void {
    this.jobs.set(job.idempotencyKey, cloneProvisioningJob(job));
  }
}

export class AdapterExecutionError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly failureClass?: ProvisioningFailureClass;

  constructor(
    code: string,
    message: string,
    options:
      | boolean
      | {
          retryable?: boolean;
          failureClass?: ProvisioningFailureClass;
        } = true,
  ) {
    super(message);
    this.name = "AdapterExecutionError";
    this.code = code;
    this.retryable =
      typeof options === "boolean" ? options : options.retryable ?? true;
    this.failureClass =
      typeof options === "boolean" ? undefined : options.failureClass;
  }
}

export interface OrchestrationResult {
  job: ProvisioningJobV1;
  preparedPayload?: PreparedProvisioningPayload;
  selectedAdapterMode: AdapterMode;
  attemptExecuted: boolean;
}

export interface ProvisioningOrchestratorOptions {
  adapters: UniversityAdapter[];
  jobStore: ProvisioningJobStore;
  maxAttempts?: number;
  now?: () => string;
}

export interface AdapterRouteSelection {
  adapter: UniversityAdapter;
  selectedAdapterMode: AdapterMode;
  routingDecision: ProvisioningRoutingDecisionV1;
}

export interface FailureRetryPolicy {
  disposition: FailureDisposition;
  maxAttempts: number;
  initialDelayMinutes: number;
  backoffMultiplier: number;
}

export interface ProvisioningFailureDecision {
  code: string;
  failureClass: ProvisioningFailureClass;
  disposition: FailureDisposition;
  maxAttempts: number;
  retryDelayMinutes?: number;
  retryScheduledAt?: string;
}

function hasValue(value: string | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

function sanitizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const LEGAL_PROVISIONING_JOB_TRANSITIONS: Record<
  ProvisioningJobStatus,
  ProvisioningJobStatus[]
> = {
  pending: ["in_progress", "failed"],
  in_progress: ["retry_pending", "completed", "failed"],
  retry_pending: ["in_progress", "failed"],
  completed: [],
  failed: [],
};

export const DEFAULT_RETRY_POLICY_BY_FAILURE_CLASS: Record<
  ProvisioningFailureClass,
  FailureRetryPolicy
> = {
  connectivity: {
    disposition: "retry",
    maxAttempts: 3,
    initialDelayMinutes: 5,
    backoffMultiplier: 2,
  },
  rate_limit: {
    disposition: "retry",
    maxAttempts: 4,
    initialDelayMinutes: 15,
    backoffMultiplier: 2,
  },
  partner_system: {
    disposition: "retry",
    maxAttempts: 3,
    initialDelayMinutes: 10,
    backoffMultiplier: 2,
  },
  verification: {
    disposition: "retry",
    maxAttempts: 2,
    initialDelayMinutes: 10,
    backoffMultiplier: 1,
  },
  reconciliation: {
    disposition: "retry",
    maxAttempts: 2,
    initialDelayMinutes: 15,
    backoffMultiplier: 1,
  },
  data_quality: {
    disposition: "terminal",
    maxAttempts: 1,
    initialDelayMinutes: 0,
    backoffMultiplier: 1,
  },
  duplicate_record: {
    disposition: "terminal",
    maxAttempts: 1,
    initialDelayMinutes: 0,
    backoffMultiplier: 1,
  },
  authorization: {
    disposition: "terminal",
    maxAttempts: 1,
    initialDelayMinutes: 0,
    backoffMultiplier: 1,
  },
  configuration: {
    disposition: "terminal",
    maxAttempts: 1,
    initialDelayMinutes: 0,
    backoffMultiplier: 1,
  },
  unexpected: {
    disposition: "terminal",
    maxAttempts: 1,
    initialDelayMinutes: 0,
    backoffMultiplier: 1,
  },
};

const DEFAULT_FAILURE_CLASS_BY_CODE: Record<string, ProvisioningFailureClass> = {
  upstream_timeout: "connectivity",
  partner_timeout: "connectivity",
  network_unreachable: "connectivity",
  rate_limited: "rate_limit",
  partner_unavailable: "partner_system",
  verification_failed: "verification",
  reconciliation_pending: "reconciliation",
  reconciliation_exception: "reconciliation",
  invalid_payload: "data_quality",
  validation_failed: "data_quality",
  duplicate_record: "duplicate_record",
  invalid_credentials: "authorization",
  configuration_error: "configuration",
  unexpected_error: "unexpected",
};

function ensureCompatibleVersion(
  schemaVersion: SchemaVersion,
  compatibilityVersion: SchemaVersion,
  label: string,
): void {
  if (!isBackwardCompatibleVersion(schemaVersion, compatibilityVersion)) {
    throw new Error(`${label} compatibilityVersion is not backward compatible.`);
  }
}

export function validateDecisionRecord(decision: DecisionRecordV1): string[] {
  const errors: string[] = [];

  if (decision.schema !== "DecisionRecordV1") {
    errors.push("Decision record schema must equal DecisionRecordV1.");
  }

  if (!hasValue(decision.decisionId)) {
    errors.push("decisionId is required.");
  }

  if (!hasValue(decision.applicationId)) {
    errors.push("applicationId is required.");
  }

  if (!hasValue(decision.applicantId)) {
    errors.push("applicantId is required.");
  }

  if (!hasValue(decision.partnerId)) {
    errors.push("partnerId is required.");
  }

  if (!hasValue(decision.correlationId)) {
    errors.push("correlationId is required.");
  }

  if (!hasValue(decision.decidedAt)) {
    errors.push("decidedAt is required.");
  }

  if (!hasValue(decision.decidedBy)) {
    errors.push("decidedBy is required.");
  }

  ensureCompatibleVersion(
    decision.schemaVersion,
    decision.compatibilityVersion,
    "DecisionRecordV1",
  );

  return errors;
}

function addMinutes(isoTimestamp: string, minutes: number): string {
  return new Date(Date.parse(isoTimestamp) + minutes * 60_000).toISOString();
}

function buildCapabilitySnapshot(
  profile: UniversityCapabilityProfile,
): ProvisioningRoutingDecisionV1["capabilitySnapshot"] {
  return {
    transportMode: profile.transportMode,
    manifestFormat: profile.manifestFormat,
    acceptsDocumentsInline: String(profile.acceptsDocumentsInline),
    duplicateCheckStrategy: profile.duplicateCheckStrategy,
  };
}

function supportsRoutingProfile(
  adapter: UniversityAdapter,
  profile: UniversityCapabilityProfile,
): boolean {
  if (adapter.mode !== profile.transportMode) {
    return false;
  }

  const routingProfile = adapter.routingProfile;
  if (!routingProfile) {
    return true;
  }

  if (
    routingProfile.supportedManifestFormats &&
    !routingProfile.supportedManifestFormats.includes(profile.manifestFormat)
  ) {
    return false;
  }

  if (
    routingProfile.supportsInlineDocuments !== undefined &&
    routingProfile.supportsInlineDocuments !== profile.acceptsDocumentsInline
  ) {
    return false;
  }

  if (
    routingProfile.supportedDuplicateCheckStrategies &&
    !routingProfile.supportedDuplicateCheckStrategies.includes(
      profile.duplicateCheckStrategy,
    )
  ) {
    return false;
  }

  return true;
}

function createRoutingReason(
  profile: UniversityCapabilityProfile,
  adapter: UniversityAdapter,
): string {
  const matchedRules = [`transportMode=${profile.transportMode}`];
  const routingProfile = adapter.routingProfile;

  if (routingProfile?.supportedManifestFormats) {
    matchedRules.push(`manifestFormat=${profile.manifestFormat}`);
  }

  if (routingProfile?.supportsInlineDocuments !== undefined) {
    matchedRules.push(
      `acceptsDocumentsInline=${String(profile.acceptsDocumentsInline)}`,
    );
  }

  if (routingProfile?.supportedDuplicateCheckStrategies) {
    matchedRules.push(
      `duplicateCheckStrategy=${profile.duplicateCheckStrategy}`,
    );
  }

  return `Selected route ${routingProfile?.routeKey ?? adapter.mode} using ${matchedRules.join(", ")}.`;
}

export function resolveAdapterRoute(input: {
  adapters: UniversityAdapter[];
  overlay: UniversityMappingOverlayV1;
  selectedAt: string;
  preferredRouteKey?: string;
}): AdapterRouteSelection {
  const candidates = input.adapters
    .filter((adapter) =>
      supportsRoutingProfile(adapter, input.overlay.capabilityProfile),
    )
    .sort((left, right) => {
      const leftPriority = left.routingProfile?.priority ?? 0;
      const rightPriority = right.routingProfile?.priority ?? 0;
      if (leftPriority !== rightPriority) {
        return rightPriority - leftPriority;
      }

      const leftKey = left.routingProfile?.routeKey ?? left.mode;
      const rightKey = right.routingProfile?.routeKey ?? right.mode;
      return leftKey.localeCompare(rightKey);
    });

  if (candidates.length === 0) {
    throw new Error(
      `No adapter route supports capability profile ${input.overlay.capabilityProfile.transportMode}/${input.overlay.capabilityProfile.manifestFormat}/${input.overlay.capabilityProfile.duplicateCheckStrategy}.`,
    );
  }

  const selectedAdapter =
    (input.preferredRouteKey
      ? candidates.find(
          (candidate) =>
            (candidate.routingProfile?.routeKey ?? candidate.mode) ===
            input.preferredRouteKey,
        )
      : undefined) ?? candidates[0];

  return {
    adapter: selectedAdapter,
    selectedAdapterMode: selectedAdapter.mode,
    routingDecision: {
      routeKey:
        selectedAdapter.routingProfile?.routeKey ?? selectedAdapter.mode,
      selectedAt: input.selectedAt,
      priority: selectedAdapter.routingProfile?.priority ?? 0,
      reason: createRoutingReason(
        input.overlay.capabilityProfile,
        selectedAdapter,
      ),
      capabilitySnapshot: buildCapabilitySnapshot(
        input.overlay.capabilityProfile,
      ),
    },
  };
}

function calculateRetryDelayMinutes(
  policy: FailureRetryPolicy,
  attemptNumber: number,
): number {
  return Math.max(
    0,
    policy.initialDelayMinutes *
      policy.backoffMultiplier ** Math.max(0, attemptNumber - 1),
  );
}

export function classifyProvisioningFailure(input: {
  code: string;
  adapter?: UniversityAdapter;
  adapterError?: AdapterExecutionError;
  occurredAt: string;
  attemptNumber: number;
  jobMaxAttempts: number;
}): ProvisioningFailureDecision {
  const adapterTaxonomy = input.adapter?.failureTaxonomy;
  const failureClass =
    input.adapterError?.failureClass ??
    adapterTaxonomy?.codeFailureClasses?.[input.code] ??
    DEFAULT_FAILURE_CLASS_BY_CODE[input.code] ??
    "unexpected";
  const policy = DEFAULT_RETRY_POLICY_BY_FAILURE_CLASS[failureClass];
  const attemptsAllowed = Math.min(policy.maxAttempts, input.jobMaxAttempts);
  const disposition: FailureDisposition =
    input.adapterError?.retryable === false ||
    adapterTaxonomy?.terminalCodes?.includes(input.code)
      ? "terminal"
      : policy.disposition;

  if (disposition === "retry" && input.attemptNumber < attemptsAllowed) {
    const retryDelayMinutes = calculateRetryDelayMinutes(
      policy,
      input.attemptNumber,
    );
    return {
      code: input.code,
      failureClass,
      disposition,
      maxAttempts: attemptsAllowed,
      retryDelayMinutes,
      retryScheduledAt: addMinutes(input.occurredAt, retryDelayMinutes),
    };
  }

  return {
    code: input.code,
    failureClass,
    disposition: "terminal",
    maxAttempts: attemptsAllowed,
  };
}

export function createProvisioningIdempotencyKey(
  decision: DecisionRecordV1,
  overlay: UniversityMappingOverlayV1,
): string {
  return [
    decision.applicationId,
    decision.decisionId,
    overlay.partnerId,
    overlay.capabilityProfile.transportMode,
    overlay.mappingProfileId,
    overlay.overlayId,
  ].join(":");
}

function createProvisioningTransitionId(
  jobId: string,
  sequence: number,
): string {
  return [
    "transition",
    sanitizeToken(jobId),
    String(sequence).padStart(3, "0"),
  ].join("-");
}

export function canTransitionProvisioningJob(
  fromStatus: ProvisioningJobStatus,
  toStatus: ProvisioningJobStatus,
): boolean {
  return LEGAL_PROVISIONING_JOB_TRANSITIONS[fromStatus].includes(toStatus);
}

export function transitionProvisioningJob(input: {
  job: ProvisioningJobV1;
  toStatus: ProvisioningJobStatus;
  transitionedAt: string;
  reason: string;
  metadata?: Record<string, string>;
}): ProvisioningJobV1 {
  const { job, toStatus, transitionedAt, reason, metadata } = input;
  if (!canTransitionProvisioningJob(job.status, toStatus)) {
    throw new Error(
      `Invalid provisioning job transition from ${job.status} to ${toStatus}.`,
    );
  }

  job.transitionHistory.push({
    transitionId: createProvisioningTransitionId(
      job.jobId,
      job.transitionHistory.length + 1,
    ),
    fromStatus: job.status,
    toStatus,
    transitionedAt,
    reason,
    metadata: metadata ? { ...metadata } : undefined,
  });
  job.status = toStatus;
  job.updatedAt = transitionedAt;
  return job;
}

export function createProvisioningJob(
  decision: DecisionRecordV1,
  overlay: UniversityMappingOverlayV1,
  createdAt: string,
  routingDecision: ProvisioningRoutingDecisionV1,
  maxAttempts = 3,
): ProvisioningJobV1 {
  const idempotencyKey = createProvisioningIdempotencyKey(decision, overlay);
  const jobId = [
    "prov",
    sanitizeToken(decision.decisionId),
    sanitizeToken(overlay.partnerId),
    sanitizeToken(overlay.capabilityProfile.transportMode),
    sanitizeToken(overlay.overlayId),
  ].join("-");

  return {
    ...provisioningJobSchemaDefaults,
    jobId,
    idempotencyKey,
    decisionId: decision.decisionId,
    applicationId: decision.applicationId,
    applicantId: decision.applicantId,
    partnerId: decision.partnerId,
    partnerName: decision.partnerName,
    correlationId: decision.correlationId,
    adapterMode: overlay.capabilityProfile.transportMode,
    routingDecision: cloneProvisioningRoutingDecision(routingDecision),
    status: "pending",
    createdAt,
    updatedAt: createdAt,
    maxAttempts,
    attempts: [],
    transitionHistory: [
      {
        transitionId: createProvisioningTransitionId(jobId, 1),
        fromStatus: "none",
        toStatus: "pending",
        transitionedAt: createdAt,
        reason: "Provisioning job created.",
        metadata: {
          routeKey: routingDecision.routeKey,
        },
      },
    ],
  };
}

function createPreparedEnvelopeId(job: ProvisioningJobV1, attemptNumber: number): string {
  return `${job.jobId}-attempt-${attemptNumber}`;
}

function createDefaultPreparedPayload(
  application: CanonicalApplicationV1,
  decision: DecisionRecordV1,
  overlay: UniversityMappingOverlayV1,
  job: ProvisioningJobV1,
): PreparedProvisioningPayload {
  const nextAttemptNumber = job.attempts.length + 1;

  return {
    envelopeId: createPreparedEnvelopeId(job, nextAttemptNumber),
    jobId: job.jobId,
    applicationId: application.applicationId,
    decisionId: decision.decisionId,
    adapterMode: overlay.capabilityProfile.transportMode,
    idempotencyKey: job.idempotencyKey,
    fieldCount: overlay.fieldMappings.length,
    documentCount: application.documents.length,
  };
}

function normalizeAdapterError(error: unknown): AdapterExecutionError {
  if (error instanceof AdapterExecutionError) {
    return error;
  }

  if (error instanceof Error) {
    return new AdapterExecutionError("unexpected_error", error.message, {
      retryable: false,
      failureClass: "unexpected",
    });
  }

  return new AdapterExecutionError("unexpected_error", "Unknown adapter failure", {
    retryable: false,
    failureClass: "unexpected",
  });
}

export class ProvisioningOrchestrator {
  private readonly adapters: UniversityAdapter[];
  private readonly jobStore: ProvisioningJobStore;
  private readonly maxAttempts: number;
  private readonly now: () => string;

  constructor(options: ProvisioningOrchestratorOptions) {
    this.adapters = [...options.adapters];
    this.jobStore = options.jobStore;
    this.maxAttempts = options.maxAttempts ?? 3;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async processDecision(input: {
    application: CanonicalApplicationV1;
    decision: DecisionRecordV1;
    overlay: UniversityMappingOverlayV1;
    ignoreRetrySchedule?: boolean;
  }): Promise<OrchestrationResult> {
    const { application, decision, overlay, ignoreRetrySchedule } = input;
    const applicationValidation = validateCanonicalApplication(application);
    const overlayValidation = validateUniversityMappingOverlay(overlay);
    const decisionValidation = validateDecisionRecord(decision);
    const errors = [
      ...applicationValidation.errors,
      ...overlayValidation.errors,
      ...decisionValidation,
    ];

    if (decision.applicationId !== application.applicationId) {
      errors.push("Decision record applicationId must match the canonical application.");
    }

    if (decision.applicantId !== application.applicantId) {
      errors.push("Decision record applicantId must match the canonical application.");
    }

    if (decision.partnerId !== overlay.partnerId) {
      errors.push("Decision record partnerId must match the university mapping overlay.");
    }

    if (errors.length > 0) {
      throw new Error(errors.join(" "));
    }

    const idempotencyKey = createProvisioningIdempotencyKey(decision, overlay);
    const existingJob = this.jobStore.getByIdempotencyKey(idempotencyKey);

    if (existingJob?.status === "completed") {
      return {
        job: existingJob,
        selectedAdapterMode: existingJob.adapterMode,
        attemptExecuted: false,
      };
    }

    if (existingJob?.status === "failed" || existingJob?.status === "in_progress") {
      return {
        job: existingJob,
        selectedAdapterMode: existingJob.adapterMode,
        attemptExecuted: false,
      };
    }

    if (existingJob && existingJob.attempts.length >= existingJob.maxAttempts) {
      return {
        job: existingJob,
        selectedAdapterMode: existingJob.adapterMode,
        attemptExecuted: false,
      };
    }

    const startedAt = this.now();
    if (
      !ignoreRetrySchedule &&
      existingJob?.status === "retry_pending" &&
      existingJob.nextRetryAt &&
      existingJob.nextRetryAt > startedAt
    ) {
      return {
        job: existingJob,
        selectedAdapterMode: existingJob.adapterMode,
        attemptExecuted: false,
      };
    }

    const adapterSelection = resolveAdapterRoute({
      adapters: this.adapters,
      overlay,
      selectedAt: startedAt,
      preferredRouteKey: existingJob?.routingDecision.routeKey,
    });
    const selectedAdapterMode = adapterSelection.selectedAdapterMode;
    const adapter = adapterSelection.adapter;
    const job =
      existingJob ??
      createProvisioningJob(
        decision,
        overlay,
        startedAt,
        adapterSelection.routingDecision,
        this.maxAttempts,
      );
    const attemptNumber = job.attempts.length + 1;
    const context: AdapterContext = {
      jobId: job.jobId,
      correlationId: job.correlationId,
      idempotencyKey: job.idempotencyKey,
      attemptNumber,
    };
    job.nextRetryAt = undefined;
    job.terminalFailureClass = undefined;
    job.terminalFailureCode = undefined;

    transitionProvisioningJob({
      job,
      toStatus: "in_progress",
      transitionedAt: startedAt,
      reason: `Attempt ${attemptNumber} started.`,
      metadata: {
        attemptNumber: String(attemptNumber),
        routeKey: job.routingDecision.routeKey,
        routePriority: String(job.routingDecision.priority),
      },
    });
    this.jobStore.save(job);

    let preparedPayload: PreparedProvisioningPayload | undefined;

    try {
      preparedPayload = await adapter.prepare({ application, decision, overlay, job });
      if (!preparedPayload) {
        preparedPayload = createDefaultPreparedPayload(application, decision, overlay, job);
      }
      const execution = await adapter.execute(preparedPayload, context);
      const verification = await adapter.verify(preparedPayload, execution, context);
      const reconciliation = await adapter.reconcile(preparedPayload, verification, context);

      let outcome: ProvisioningAttemptOutcome = "succeeded";
      let status: ProvisioningJobStatus = "completed";
      let failureDecision: ProvisioningFailureDecision | undefined;
      let errorCode: string | undefined;
      let errorMessage: string | undefined;

      if (!verification.verified) {
        errorCode = "verification_failed";
        errorMessage = "Adapter verification did not confirm the downstream record.";
      } else if (reconciliation.status === "pending") {
        errorCode = "reconciliation_pending";
        errorMessage = reconciliation.details ?? "Reconciliation remains pending.";
      } else if (reconciliation.status === "exception") {
        errorCode = "reconciliation_exception";
        errorMessage = reconciliation.details ?? "Reconciliation found a downstream exception.";
      }

      const completedAt = this.now();
      if (errorCode) {
        failureDecision = classifyProvisioningFailure({
          code: errorCode,
          adapter,
          occurredAt: completedAt,
          attemptNumber,
          jobMaxAttempts: job.maxAttempts,
        });
        outcome =
          failureDecision.disposition === "retry"
            ? "retryable_error"
            : "failed";
        status =
          failureDecision.disposition === "retry"
            ? "retry_pending"
            : "failed";
      }

      job.attempts.push({
        attemptNumber,
        startedAt,
        completedAt,
        outcome,
        externalReference: execution.externalReference,
        errorCode,
        errorMessage,
        failureClass: failureDecision?.failureClass,
        failureDisposition: failureDecision?.disposition,
        retryDelayMinutes: failureDecision?.retryDelayMinutes,
        retryScheduledAt: failureDecision?.retryScheduledAt,
      });
      job.targetRecordRef = execution.externalReference;
      job.lastErrorCode = errorCode;
      job.nextRetryAt = failureDecision?.retryScheduledAt;
      job.terminalFailureCode =
        failureDecision?.disposition === "terminal"
          ? failureDecision.code
          : undefined;
      job.terminalFailureClass =
        failureDecision?.disposition === "terminal"
          ? failureDecision.failureClass
          : undefined;
      transitionProvisioningJob({
        job,
        toStatus: status,
        transitionedAt: completedAt,
        reason:
          status === "completed"
            ? `Attempt ${attemptNumber} completed successfully.`
            : status === "retry_pending"
              ? `Attempt ${attemptNumber} requires retry due to ${errorCode}.`
              : `Attempt ${attemptNumber} failed due to ${errorCode}.`,
        metadata: {
          attemptNumber: String(attemptNumber),
          outcome,
          errorCode: errorCode ?? "",
          failureClass: failureDecision?.failureClass ?? "",
          failureDisposition: failureDecision?.disposition ?? "",
          retryScheduledAt: failureDecision?.retryScheduledAt ?? "",
        },
      });
      this.jobStore.save(job);

      return {
        job,
        preparedPayload,
        selectedAdapterMode,
        attemptExecuted: true,
      };
    } catch (error) {
      const adapterError = normalizeAdapterError(error);
      const completedAt = this.now();
      const failureDecision = classifyProvisioningFailure({
        code: adapterError.code,
        adapter,
        adapterError,
        occurredAt: completedAt,
        attemptNumber,
        jobMaxAttempts: job.maxAttempts,
      });
      const outcome: ProvisioningAttemptOutcome =
        failureDecision.disposition === "retry"
          ? "retryable_error"
          : "failed";
      const nextStatus: ProvisioningJobStatus =
        failureDecision.disposition === "retry"
          ? "retry_pending"
          : "failed";

      job.attempts.push({
        attemptNumber,
        startedAt,
        completedAt,
        outcome,
        errorCode: adapterError.code,
        errorMessage: adapterError.message,
        failureClass: failureDecision.failureClass,
        failureDisposition: failureDecision.disposition,
        retryDelayMinutes: failureDecision.retryDelayMinutes,
        retryScheduledAt: failureDecision.retryScheduledAt,
      });
      job.lastErrorCode = adapterError.code;
      job.nextRetryAt = failureDecision.retryScheduledAt;
      job.terminalFailureCode =
        failureDecision.disposition === "terminal"
          ? failureDecision.code
          : undefined;
      job.terminalFailureClass =
        failureDecision.disposition === "terminal"
          ? failureDecision.failureClass
          : undefined;
      transitionProvisioningJob({
        job,
        toStatus: nextStatus,
        transitionedAt: completedAt,
        reason:
          nextStatus === "retry_pending"
            ? `Attempt ${attemptNumber} requires retry due to ${adapterError.code}.`
            : `Attempt ${attemptNumber} failed due to ${adapterError.code}.`,
        metadata: {
          attemptNumber: String(attemptNumber),
          outcome,
          errorCode: adapterError.code,
          failureClass: failureDecision.failureClass,
          failureDisposition: failureDecision.disposition,
          retryScheduledAt: failureDecision.retryScheduledAt ?? "",
        },
      });
      this.jobStore.save(job);

      return {
        job,
        preparedPayload,
        selectedAdapterMode,
        attemptExecuted: true,
      };
    }
  }
}
