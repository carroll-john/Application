import type {
  SchemaVersion,
  UniversityCapabilityProfile,
  UniversityMappingOverlayV1,
} from "./contracts";
import { isBackwardCompatibleVersion } from "./contracts";
import type { ProvisioningFailureClass } from "./provisioning";
import type { ValidationResult } from "./validation";

export const IMPORT_WORKFLOW_DISPATCH_PAYLOAD_SCHEMA_VERSION = "1.0.0";
export const IMPORT_WORKFLOW_VERIFICATION_RECEIPT_SCHEMA_VERSION = "1.0.0";

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T.*)?$/;

export type ImportWorkflowDispatchChannel = "managed-import";

export type ImportWorkflowVerificationStatus =
  | "accepted"
  | "processing"
  | "imported"
  | "duplicate"
  | "rejected"
  | "failed";

export interface ImportWorkflowDispatchPayloadV1 {
  schema: "ImportWorkflowDispatchPayloadV1";
  schemaVersion: SchemaVersion;
  compatibilityVersion: SchemaVersion;
  workflowId: string;
  dispatchChannel: ImportWorkflowDispatchChannel;
  dropLocation: string;
  statusTarget: string;
  receiptTarget: string;
  routeKey: string;
  envelopeId: string;
  jobId: string;
  idempotencyKey: string;
  decisionId: string;
  applicationId: string;
  partnerId: string;
  partnerName: string;
  overlayId: string;
  mappingProfileId: string;
  manifestFormat: "xml";
  acceptsDocumentsInline: true;
  duplicateCheckStrategy: "email-and-course";
  fieldCount: number;
  documentCount: number;
}

export const importWorkflowDispatchPayloadSchemaDefaults: Pick<
  ImportWorkflowDispatchPayloadV1,
  "schema" | "schemaVersion" | "compatibilityVersion"
> = {
  schema: "ImportWorkflowDispatchPayloadV1",
  schemaVersion: IMPORT_WORKFLOW_DISPATCH_PAYLOAD_SCHEMA_VERSION,
  compatibilityVersion: IMPORT_WORKFLOW_DISPATCH_PAYLOAD_SCHEMA_VERSION,
};

export interface ImportWorkflowVerificationReceiptV1 {
  schema: "ImportWorkflowVerificationReceiptV1";
  schemaVersion: SchemaVersion;
  compatibilityVersion: SchemaVersion;
  workflowId: string;
  jobId: string;
  envelopeId: string;
  idempotencyKey: string;
  externalReference: string;
  receiptTarget: string;
  observedAt: string;
  status: ImportWorkflowVerificationStatus;
  reasonCode?: string;
  details?: string;
}

export const importWorkflowVerificationReceiptSchemaDefaults: Pick<
  ImportWorkflowVerificationReceiptV1,
  "schema" | "schemaVersion" | "compatibilityVersion"
> = {
  schema: "ImportWorkflowVerificationReceiptV1",
  schemaVersion: IMPORT_WORKFLOW_VERIFICATION_RECEIPT_SCHEMA_VERSION,
  compatibilityVersion: IMPORT_WORKFLOW_VERIFICATION_RECEIPT_SCHEMA_VERSION,
};

export interface ImportWorkflowVerificationOutcome {
  kind: "verified" | "error";
  reconciliationStatus?: "matched" | "pending";
  errorCode?: string;
  errorMessage?: string;
  retryable?: boolean;
  failureClass?: ProvisioningFailureClass;
}

function hasValue(value: string | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

function validateIsoDate(
  value: string | undefined,
  field: string,
  errors: string[],
): void {
  if (value && !ISO_DATE_REGEX.test(value)) {
    errors.push(`${field} must be an ISO-8601 date or timestamp.`);
  }
}

function validateCompatibleVersion(
  schemaVersion: SchemaVersion,
  compatibilityVersion: SchemaVersion,
  errors: string[],
): void {
  if (!isBackwardCompatibleVersion(schemaVersion, compatibilityVersion)) {
    errors.push(
      "compatibilityVersion must be backward compatible with schemaVersion.",
    );
  }
}

function validateCapabilityProfile(
  profile: UniversityCapabilityProfile,
  errors: string[],
): void {
  if (profile.transportMode !== "import-workflow") {
    errors.push(
      "capabilityProfile.transportMode must equal import-workflow for import payloads.",
    );
  }

  if (profile.manifestFormat !== "xml") {
    errors.push(
      "capabilityProfile.manifestFormat must equal xml for import payloads.",
    );
  }

  if (!profile.acceptsDocumentsInline) {
    errors.push(
      "capabilityProfile.acceptsDocumentsInline must be true for import payloads.",
    );
  }

  if (profile.duplicateCheckStrategy !== "email-and-course") {
    errors.push(
      "capabilityProfile.duplicateCheckStrategy must equal email-and-course for import payloads.",
    );
  }
}

export function createImportWorkflowDispatchPayload(input: {
  workflowId: string;
  dropLocation: string;
  statusTarget: string;
  receiptTarget: string;
  routeKey: string;
  envelopeId: string;
  jobId: string;
  idempotencyKey: string;
  decisionId: string;
  applicationId: string;
  overlay: Pick<
    UniversityMappingOverlayV1,
    | "partnerId"
    | "partnerName"
    | "overlayId"
    | "mappingProfileId"
    | "capabilityProfile"
  >;
  fieldCount: number;
  documentCount: number;
}): ImportWorkflowDispatchPayloadV1 {
  return {
    ...importWorkflowDispatchPayloadSchemaDefaults,
    workflowId: input.workflowId,
    dispatchChannel: "managed-import",
    dropLocation: input.dropLocation,
    statusTarget: input.statusTarget,
    receiptTarget: input.receiptTarget,
    routeKey: input.routeKey,
    envelopeId: input.envelopeId,
    jobId: input.jobId,
    idempotencyKey: input.idempotencyKey,
    decisionId: input.decisionId,
    applicationId: input.applicationId,
    partnerId: input.overlay.partnerId,
    partnerName: input.overlay.partnerName,
    overlayId: input.overlay.overlayId,
    mappingProfileId: input.overlay.mappingProfileId,
    manifestFormat: "xml",
    acceptsDocumentsInline: true,
    duplicateCheckStrategy: "email-and-course",
    fieldCount: input.fieldCount,
    documentCount: input.documentCount,
  };
}

export function validateImportWorkflowDispatchPayload(
  payload: ImportWorkflowDispatchPayloadV1,
): ValidationResult {
  const errors: string[] = [];

  if (payload.schema !== "ImportWorkflowDispatchPayloadV1") {
    errors.push("schema must equal ImportWorkflowDispatchPayloadV1.");
  }

  validateCompatibleVersion(
    payload.schemaVersion,
    payload.compatibilityVersion,
    errors,
  );

  [
    "workflowId",
    "dropLocation",
    "statusTarget",
    "receiptTarget",
    "routeKey",
    "envelopeId",
    "jobId",
    "idempotencyKey",
    "decisionId",
    "applicationId",
    "partnerId",
    "partnerName",
    "overlayId",
    "mappingProfileId",
  ].forEach((field) => {
    const value = payload[field as keyof ImportWorkflowDispatchPayloadV1];
    if (typeof value !== "string" || !hasValue(value)) {
      errors.push(`${field} is required.`);
    }
  });

  if (payload.dispatchChannel !== "managed-import") {
    errors.push("dispatchChannel must equal managed-import.");
  }

  validateCapabilityProfile(
    {
      transportMode: "import-workflow",
      manifestFormat: payload.manifestFormat,
      acceptsDocumentsInline: payload.acceptsDocumentsInline,
      duplicateCheckStrategy: payload.duplicateCheckStrategy,
    },
    errors,
  );

  if (payload.fieldCount <= 0) {
    errors.push("fieldCount must be greater than zero.");
  }

  if (payload.documentCount < 0) {
    errors.push("documentCount must be zero or greater.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function createImportWorkflowVerificationReceipt(input: {
  workflowId: string;
  jobId: string;
  envelopeId: string;
  idempotencyKey: string;
  externalReference: string;
  receiptTarget: string;
  observedAt: string;
  status: ImportWorkflowVerificationStatus;
  reasonCode?: string;
  details?: string;
}): ImportWorkflowVerificationReceiptV1 {
  return {
    ...importWorkflowVerificationReceiptSchemaDefaults,
    workflowId: input.workflowId,
    jobId: input.jobId,
    envelopeId: input.envelopeId,
    idempotencyKey: input.idempotencyKey,
    externalReference: input.externalReference,
    receiptTarget: input.receiptTarget,
    observedAt: input.observedAt,
    status: input.status,
    reasonCode: input.reasonCode,
    details: input.details,
  };
}

export function validateImportWorkflowVerificationReceipt(
  receipt: ImportWorkflowVerificationReceiptV1,
): ValidationResult {
  const errors: string[] = [];

  if (receipt.schema !== "ImportWorkflowVerificationReceiptV1") {
    errors.push("schema must equal ImportWorkflowVerificationReceiptV1.");
  }

  validateCompatibleVersion(
    receipt.schemaVersion,
    receipt.compatibilityVersion,
    errors,
  );

  [
    "workflowId",
    "jobId",
    "envelopeId",
    "idempotencyKey",
    "externalReference",
    "receiptTarget",
  ].forEach((field) => {
    const value = receipt[field as keyof ImportWorkflowVerificationReceiptV1];
    if (typeof value !== "string" || !hasValue(value)) {
      errors.push(`${field} is required.`);
    }
  });

  validateIsoDate(receipt.observedAt, "observedAt", errors);

  if (
    (receipt.status === "rejected" || receipt.status === "failed") &&
    !hasValue(receipt.reasonCode)
  ) {
    errors.push("reasonCode is required when status is rejected or failed.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function classifyReceiptFailure(input: {
  status: Extract<ImportWorkflowVerificationStatus, "rejected" | "failed">;
  reasonCode?: string;
  details?: string;
}): ImportWorkflowVerificationOutcome {
  const code =
    input.reasonCode ??
    (input.status === "rejected" ? "invalid_payload" : "partner_unavailable");
  const detail =
    input.details ??
    (input.status === "rejected"
      ? "Import workflow rejected the payload."
      : "Import workflow reported a processing failure.");

  if (code === "invalid_credentials") {
    return {
      kind: "error",
      errorCode: code,
      errorMessage: detail,
      retryable: false,
      failureClass: "authorization",
    };
  }

  if (code === "duplicate_record") {
    return {
      kind: "error",
      errorCode: code,
      errorMessage: detail,
      retryable: false,
      failureClass: "duplicate_record",
    };
  }

  if (code === "invalid_payload") {
    return {
      kind: "error",
      errorCode: code,
      errorMessage: detail,
      retryable: false,
      failureClass: "data_quality",
    };
  }

  if (code === "rate_limited") {
    return {
      kind: "error",
      errorCode: code,
      errorMessage: detail,
      retryable: true,
      failureClass: "rate_limit",
    };
  }

  if (code === "network_unreachable") {
    return {
      kind: "error",
      errorCode: code,
      errorMessage: detail,
      retryable: true,
      failureClass: "connectivity",
    };
  }

  return {
    kind: "error",
    errorCode: code,
    errorMessage: detail,
    retryable: input.status === "failed",
    failureClass: input.status === "failed" ? "partner_system" : "data_quality",
  };
}

export function mapImportWorkflowVerificationReceipt(
  receipt: ImportWorkflowVerificationReceiptV1,
): ImportWorkflowVerificationOutcome {
  if (receipt.status === "accepted" || receipt.status === "processing") {
    return {
      kind: "verified",
      reconciliationStatus: "pending",
    };
  }

  if (receipt.status === "imported" || receipt.status === "duplicate") {
    return {
      kind: "verified",
      reconciliationStatus: "matched",
    };
  }

  return classifyReceiptFailure({
    status: receipt.status,
    reasonCode: receipt.reasonCode,
    details: receipt.details,
  });
}
