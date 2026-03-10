# Import Workflow Contracts V1

This document captures the `DIS-74` baseline for the import-workflow handoff payload and verification receipt contract.

## Dispatch Payload

`ImportWorkflowDispatchPayloadV1` is the versioned handoff contract emitted by the import-workflow adapter during `prepare`.

Required fields:
- `schema`
- `schemaVersion`
- `compatibilityVersion`
- `workflowId`
- `dispatchChannel`
- `dropLocation`
- `statusTarget`
- `receiptTarget`
- `routeKey`
- `envelopeId`
- `jobId`
- `idempotencyKey`
- `decisionId`
- `applicationId`
- `partnerId`
- `partnerName`
- `overlayId`
- `mappingProfileId`
- `manifestFormat`
- `acceptsDocumentsInline`
- `duplicateCheckStrategy`
- `fieldCount`
- `documentCount`

Contract rules:
- `dispatchChannel` must equal `managed-import`.
- The payload only supports the import-workflow capability profile: XML manifests, inline documents, and `email-and-course` duplicate detection.
- Invalid payloads are rejected before execution with actionable validation errors.

## Verification Receipt

`ImportWorkflowVerificationReceiptV1` is the versioned receipt contract consumed by `verify` and `reconcile`.

Statuses:
- `accepted`
- `processing`
- `imported`
- `duplicate`
- `rejected`
- `failed`

Validation rules:
- `reasonCode` is required when status is `rejected` or `failed`.
- `observedAt` must be ISO-8601.
- `workflowId`, `jobId`, `envelopeId`, `idempotencyKey`, `externalReference`, and `receiptTarget` are required.

## Provisioning Mapping

Receipt statuses map into provisioning behavior as follows:
- `accepted` and `processing` keep verification valid but map reconciliation to `pending`, which yields `retry_pending`.
- `imported` and `duplicate` map reconciliation to `matched`, which yields `completed`.
- `rejected` maps to terminal failures, defaulting to `invalid_payload` when no explicit reason code is supplied.
- `failed` maps to retryable partner-system failures by default, unless the reason code maps into a more specific failure class.

## Prepared Payload Surface

`PreparedProvisioningPayload` now exposes the structured import handoff object on `dispatchPayload` alongside the string metadata already used by the scaffold. That keeps the orchestrator contract generic while still giving import-workflow routes a concrete, versioned payload surface.
