# Integration Orchestration V1

This document captures the `DIS-61` baseline for deterministic provisioning orchestration and the pluggable adapter lifecycle.

## Lifecycle Contract

Every adapter must implement the same four-step lifecycle:
- `prepare`
- `execute`
- `verify`
- `reconcile`

The orchestrator selects the adapter from `UniversityMappingOverlayV1.capabilityProfile.transportMode`, so partner mode can change without changing the canonical application or decision schemas.

## Decision Contract

`DecisionRecordV1` is the event envelope that triggers provisioning. Required fields:
- `decisionId`
- `applicationId`
- `applicantId`
- `partnerId`
- `partnerName`
- `decidedAt`
- `decidedBy`
- `correlationId`
- `outcome.status`

Validation rules:
- Decision/application/applicant identifiers must align with the canonical application.
- `partnerId` must align with the selected university mapping overlay.
- `compatibilityVersion` must remain backward compatible with `schemaVersion`.

## Provisioning Job Model

`ProvisioningJobV1` is deterministic per application decision, destination mode, and mapping overlay version.

Deterministic fields:
- `jobId = prov-{decisionId}-{partnerId}-{adapterMode}-{overlayId}`
- `idempotencyKey = {applicationId}:{decisionId}:{partnerId}:{adapterMode}:{mappingProfileId}:{overlayId}`

State model:
- `pending`
- `in_progress`
- `retry_pending`
- `completed`
- `failed`

Legal transitions:
- `pending -> in_progress | failed`
- `in_progress -> retry_pending | completed | failed`
- `retry_pending -> in_progress | failed`

Transition history:
- Every job starts with a persisted `none -> pending` transition.
- Each later state change appends a transition record with timestamp, reason, and optional metadata such as `attemptNumber` and `errorCode`.
- Jobs can be queried by current status for operations and reconciliation workflows.

Attempt model:
- Each run appends a `ProvisioningAttemptV1` record with outcome, timestamps, external reference, and optional error details.
- Retry attempts keep the same `jobId` and `idempotencyKey`.

## Retry Safety

Retry safety depends on two rules:
- The orchestrator reuses the stored job for the same `idempotencyKey` instead of creating a second job.
- Duplicate triggers short-circuit while an existing job is already `in_progress`.
- The adapter receives the same `idempotencyKey` on every retry so downstream APIs/imports can deduplicate side effects.

The baseline implementation retries only while `attempts.length < maxAttempts`. Completed jobs short-circuit and do not execute again.
