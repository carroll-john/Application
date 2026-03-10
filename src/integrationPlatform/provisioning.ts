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

export interface ProvisioningAttemptV1 {
  attemptNumber: number;
  startedAt: string;
  completedAt: string;
  outcome: ProvisioningAttemptOutcome;
  externalReference?: string;
  errorCode?: string;
  errorMessage?: string;
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
  status: ProvisioningJobStatus;
  createdAt: string;
  updatedAt: string;
  maxAttempts: number;
  attempts: ProvisioningAttemptV1[];
  lastErrorCode?: string;
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

export interface PreparedProvisioningPayload {
  envelopeId: string;
  jobId: string;
  applicationId: string;
  decisionId: string;
  adapterMode: AdapterMode;
  idempotencyKey: string;
  fieldCount: number;
  documentCount: number;
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

export interface UniversityAdapter {
  mode: AdapterMode;
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
  save(job: ProvisioningJobV1): void;
}

function cloneProvisioningJob(job: ProvisioningJobV1): ProvisioningJobV1 {
  return {
    ...job,
    attempts: job.attempts.map((attempt) => ({ ...attempt })),
  };
}

export class InMemoryProvisioningJobStore implements ProvisioningJobStore {
  private readonly jobs = new Map<string, ProvisioningJobV1>();

  getByIdempotencyKey(idempotencyKey: string): ProvisioningJobV1 | undefined {
    const job = this.jobs.get(idempotencyKey);
    return job ? cloneProvisioningJob(job) : undefined;
  }

  save(job: ProvisioningJobV1): void {
    this.jobs.set(job.idempotencyKey, cloneProvisioningJob(job));
  }
}

export class AdapterExecutionError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable = true) {
    super(message);
    this.name = "AdapterExecutionError";
    this.code = code;
    this.retryable = retryable;
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

function hasValue(value: string | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

function sanitizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

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

export function createProvisioningIdempotencyKey(
  decision: DecisionRecordV1,
  overlay: UniversityMappingOverlayV1,
): string {
  return [decision.decisionId, overlay.partnerId, overlay.capabilityProfile.transportMode].join(":" );
}

export function createProvisioningJob(
  decision: DecisionRecordV1,
  overlay: UniversityMappingOverlayV1,
  createdAt: string,
  maxAttempts = 3,
): ProvisioningJobV1 {
  const idempotencyKey = createProvisioningIdempotencyKey(decision, overlay);

  return {
    ...provisioningJobSchemaDefaults,
    jobId: `prov-${sanitizeToken(decision.decisionId)}-${sanitizeToken(overlay.partnerId)}-${sanitizeToken(overlay.capabilityProfile.transportMode)}`,
    idempotencyKey,
    decisionId: decision.decisionId,
    applicationId: decision.applicationId,
    applicantId: decision.applicantId,
    partnerId: decision.partnerId,
    partnerName: decision.partnerName,
    correlationId: decision.correlationId,
    adapterMode: overlay.capabilityProfile.transportMode,
    status: "pending",
    createdAt,
    updatedAt: createdAt,
    maxAttempts,
    attempts: [],
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
    return new AdapterExecutionError("unexpected_error", error.message, false);
  }

  return new AdapterExecutionError("unexpected_error", "Unknown adapter failure", false);
}

export class ProvisioningOrchestrator {
  private readonly adapterRegistry = new Map<AdapterMode, UniversityAdapter>();
  private readonly jobStore: ProvisioningJobStore;
  private readonly maxAttempts: number;
  private readonly now: () => string;

  constructor(options: ProvisioningOrchestratorOptions) {
    this.jobStore = options.jobStore;
    this.maxAttempts = options.maxAttempts ?? 3;
    this.now = options.now ?? (() => new Date().toISOString());

    options.adapters.forEach((adapter) => {
      this.adapterRegistry.set(adapter.mode, adapter);
    });
  }

  async processDecision(input: {
    application: CanonicalApplicationV1;
    decision: DecisionRecordV1;
    overlay: UniversityMappingOverlayV1;
  }): Promise<OrchestrationResult> {
    const { application, decision, overlay } = input;
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

    const selectedAdapterMode = overlay.capabilityProfile.transportMode;
    const adapter = this.adapterRegistry.get(selectedAdapterMode);

    if (!adapter) {
      throw new Error(`No adapter registered for mode ${selectedAdapterMode}.`);
    }

    const idempotencyKey = createProvisioningIdempotencyKey(decision, overlay);
    const existingJob = this.jobStore.getByIdempotencyKey(idempotencyKey);

    if (existingJob?.status === "completed") {
      return {
        job: existingJob,
        selectedAdapterMode,
        attemptExecuted: false,
      };
    }

    if (existingJob && existingJob.attempts.length >= existingJob.maxAttempts) {
      return {
        job: existingJob,
        selectedAdapterMode,
        attemptExecuted: false,
      };
    }

    const startedAt = this.now();
    const job = existingJob ?? createProvisioningJob(decision, overlay, startedAt, this.maxAttempts);
    const attemptNumber = job.attempts.length + 1;
    const context: AdapterContext = {
      jobId: job.jobId,
      correlationId: job.correlationId,
      idempotencyKey: job.idempotencyKey,
      attemptNumber,
    };

    job.status = "in_progress";
    job.updatedAt = startedAt;
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
      let errorCode: string | undefined;
      let errorMessage: string | undefined;

      if (!verification.verified) {
        outcome = attemptNumber < job.maxAttempts ? "retryable_error" : "failed";
        status = attemptNumber < job.maxAttempts ? "retry_pending" : "failed";
        errorCode = "verification_failed";
        errorMessage = "Adapter verification did not confirm the downstream record.";
      } else if (reconciliation.status === "pending") {
        outcome = attemptNumber < job.maxAttempts ? "retryable_error" : "failed";
        status = attemptNumber < job.maxAttempts ? "retry_pending" : "failed";
        errorCode = "reconciliation_pending";
        errorMessage = reconciliation.details ?? "Reconciliation remains pending.";
      } else if (reconciliation.status === "exception") {
        outcome = attemptNumber < job.maxAttempts ? "retryable_error" : "failed";
        status = attemptNumber < job.maxAttempts ? "retry_pending" : "failed";
        errorCode = "reconciliation_exception";
        errorMessage = reconciliation.details ?? "Reconciliation found a downstream exception.";
      }

      job.attempts.push({
        attemptNumber,
        startedAt,
        completedAt: this.now(),
        outcome,
        externalReference: execution.externalReference,
        errorCode,
        errorMessage,
      });
      job.status = status;
      job.updatedAt = this.now();
      job.targetRecordRef = execution.externalReference;
      job.lastErrorCode = errorCode;
      this.jobStore.save(job);

      return {
        job,
        preparedPayload,
        selectedAdapterMode,
        attemptExecuted: true,
      };
    } catch (error) {
      const adapterError = normalizeAdapterError(error);
      const outcome: ProvisioningAttemptOutcome =
        adapterError.retryable && attemptNumber < job.maxAttempts
          ? "retryable_error"
          : "failed";

      job.attempts.push({
        attemptNumber,
        startedAt,
        completedAt: this.now(),
        outcome,
        errorCode: adapterError.code,
        errorMessage: adapterError.message,
      });
      job.status =
        adapterError.retryable && attemptNumber < job.maxAttempts
          ? "retry_pending"
          : "failed";
      job.updatedAt = this.now();
      job.lastErrorCode = adapterError.code;
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
