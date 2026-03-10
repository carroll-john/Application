import { describe, expect, it } from "vitest";
import { universityMappingOverlaySamples } from "./examples";
import {
  createImportWorkflowDispatchPayload,
  createImportWorkflowVerificationReceipt,
  mapImportWorkflowVerificationReceipt,
  validateImportWorkflowDispatchPayload,
  validateImportWorkflowVerificationReceipt,
  type ImportWorkflowDispatchPayloadV1,
} from "./importWorkflowContracts";

describe("import workflow contracts", () => {
  it("builds a versioned dispatch payload for import-workflow handoff", () => {
    const overlay = universityMappingOverlaySamples[1];
    const payload = createImportWorkflowDispatchPayload({
      workflowId: "tasman-import-runner",
      dropLocation: "s3://managed-import/tasman-import-runner",
      statusTarget: "tasman-import-runner/status",
      receiptTarget:
        "s3://managed-import/tasman-import-runner/receipts/tasman-import-runner",
      routeKey: "import-workflow:tasman-import-runner",
      envelopeId: "prov-import-001-attempt-1",
      jobId: "prov-import-001",
      idempotencyKey: "app-001:decision-001:partner-001:overlay-001",
      decisionId: "decision-001",
      applicationId: "app-001",
      overlay,
      fieldCount: 14,
      documentCount: 3,
    });

    expect(payload).toMatchObject({
      schema: "ImportWorkflowDispatchPayloadV1",
      schemaVersion: "1.0.0",
      dispatchChannel: "managed-import",
      workflowId: "tasman-import-runner",
      routeKey: "import-workflow:tasman-import-runner",
      manifestFormat: "xml",
      acceptsDocumentsInline: true,
      duplicateCheckStrategy: "email-and-course",
    });
    expect(validateImportWorkflowDispatchPayload(payload)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("rejects invalid dispatch payloads with actionable errors", () => {
    const overlay = universityMappingOverlaySamples[1];
    const payload =
      createImportWorkflowDispatchPayload({
        workflowId: "tasman-import-runner",
        dropLocation: "s3://managed-import/tasman-import-runner",
        statusTarget: "tasman-import-runner/status",
        receiptTarget:
          "s3://managed-import/tasman-import-runner/receipts/tasman-import-runner",
        routeKey: "import-workflow:tasman-import-runner",
        envelopeId: "prov-import-001-attempt-1",
        jobId: "prov-import-001",
        idempotencyKey: "app-001:decision-001:partner-001:overlay-001",
        decisionId: "decision-001",
        applicationId: "app-001",
        overlay,
        fieldCount: 14,
        documentCount: 3,
      }) as ImportWorkflowDispatchPayloadV1 & {
        manifestFormat: "json";
        acceptsDocumentsInline: false;
        duplicateCheckStrategy: "source-application-id";
      };

    payload.dropLocation = "";
    payload.fieldCount = 0;
    payload.manifestFormat = "json";
    payload.acceptsDocumentsInline = false;
    payload.duplicateCheckStrategy = "source-application-id";

    expect(validateImportWorkflowDispatchPayload(payload)).toEqual({
      valid: false,
      errors: [
        "dropLocation is required.",
        "capabilityProfile.manifestFormat must equal xml for import payloads.",
        "capabilityProfile.acceptsDocumentsInline must be true for import payloads.",
        "capabilityProfile.duplicateCheckStrategy must equal email-and-course for import payloads.",
        "fieldCount must be greater than zero.",
      ],
    });
  });

  it("requires reason codes for rejected or failed verification receipts", () => {
    const receipt = createImportWorkflowVerificationReceipt({
      workflowId: "tasman-import-runner",
      jobId: "prov-import-001",
      envelopeId: "prov-import-001-attempt-1",
      idempotencyKey: "app-001:decision-001:partner-001:overlay-001",
      externalReference:
        "import:tasman-import-runner:app-001:decision-001:partner-001:overlay-001",
      receiptTarget:
        "s3://managed-import/tasman-import-runner/receipts/tasman-import-runner",
      observedAt: "2026-03-10T16:02:00Z",
      status: "rejected",
    });

    expect(validateImportWorkflowVerificationReceipt(receipt)).toEqual({
      valid: false,
      errors: ["reasonCode is required when status is rejected or failed."],
    });
  });

  it("maps verification receipts into provisioning-friendly outcomes", () => {
    const processingReceipt = createImportWorkflowVerificationReceipt({
      workflowId: "tasman-import-runner",
      jobId: "prov-import-001",
      envelopeId: "prov-import-001-attempt-1",
      idempotencyKey: "app-001:decision-001:partner-001:overlay-001",
      externalReference:
        "import:tasman-import-runner:app-001:decision-001:partner-001:overlay-001",
      receiptTarget:
        "s3://managed-import/tasman-import-runner/receipts/tasman-import-runner",
      observedAt: "2026-03-10T16:02:00Z",
      status: "processing",
      details: "Queued for the next partner import batch.",
    });
    const importedReceipt = {
      ...processingReceipt,
      status: "imported" as const,
    };
    const failedReceipt = {
      ...processingReceipt,
      status: "failed" as const,
      reasonCode: "partner_unavailable",
      details: "The partner import runner failed before writing a receipt.",
    };

    expect(mapImportWorkflowVerificationReceipt(processingReceipt)).toEqual({
      kind: "verified",
      reconciliationStatus: "pending",
    });
    expect(mapImportWorkflowVerificationReceipt(importedReceipt)).toEqual({
      kind: "verified",
      reconciliationStatus: "matched",
    });
    expect(mapImportWorkflowVerificationReceipt(failedReceipt)).toEqual({
      kind: "error",
      errorCode: "partner_unavailable",
      errorMessage:
        "The partner import runner failed before writing a receipt.",
      retryable: true,
      failureClass: "partner_system",
    });
  });
});
