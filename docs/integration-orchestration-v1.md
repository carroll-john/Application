# Integration Orchestration V1

This document captures the `DIS-61` baseline for deterministic provisioning orchestration, route selection, and the pluggable adapter lifecycle.

## Lifecycle Contract

Every adapter must implement the same four-step lifecycle:
- `prepare`
- `execute`
- `verify`
- `reconcile`

The orchestrator selects the adapter from `UniversityMappingOverlayV1.capabilityProfile`, so partner mode can change without changing the canonical application or decision schemas.

Route selection rules:
- `transportMode` remains the first discriminator.
- When multiple adapters support the same mode, the orchestrator evaluates each adapter's `routingProfile`.
- `supportedManifestFormats`, `supportsInlineDocuments`, and `supportedDuplicateCheckStrategies` must all match the overlay capability profile for a route to qualify.
- Qualified routes are ordered by `routingProfile.priority` descending, then `routeKey` ascending for deterministic selection.
- The chosen route is persisted on the job as `routingDecision` so retries and operator replay continue on the same path unless that route no longer supports the capability profile.

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
- Each attempt also persists `failureClass`, `failureDisposition`, `retryDelayMinutes`, and `retryScheduledAt` when the attempt does not complete cleanly.
- Retry attempts keep the same `jobId` and `idempotencyKey`.

## Retry Safety

Retry safety depends on two rules:
- The orchestrator reuses the stored job for the same `idempotencyKey` instead of creating a second job.
- Duplicate triggers short-circuit while an existing job is already `in_progress`.
- The adapter receives the same `idempotencyKey` on every retry so downstream APIs/imports can deduplicate side effects.

Failure handling is now class-based:
- `connectivity`, `rate_limit`, `partner_system`, `verification`, and `reconciliation` can retry with bounded backoff.
- `data_quality`, `duplicate_record`, `authorization`, `configuration`, and unexpected terminal failures stop immediately.
- Adapters can refine the default policy with `failureTaxonomy.codeFailureClasses` and `failureTaxonomy.terminalCodes`.

The baseline implementation retries only while the class policy and `maxAttempts` both allow it. `nextRetryAt` is persisted on the job, and automatic triggers short-circuit until that time arrives. Completed jobs short-circuit and do not execute again.

Operator replay is explicit:
- Exception-driven replay can bypass the scheduled retry window when an operator intentionally replays from the `execute` checkpoint.
- Manual replay still reuses the same job and idempotency key, so it overrides timing but not deduplication guarantees.
