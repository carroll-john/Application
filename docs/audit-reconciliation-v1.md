# Audit, Reconciliation, And Exception Queue V1

This document captures the `DIS-62` baseline for evidence-grade audit events, reconciliation outcomes, and replayable exceptions.

## Audit Ledger

The audit ledger records immutable job-scoped events with:
- `eventId`
- `occurredAt`
- `correlationId`
- `jobId`
- `decisionId`
- `type`
- `summary`
- optional metadata

Baseline event types:
- `job.created`
- `job.attempt.recorded`
- `job.completed`
- `job.retry_pending`
- `job.failed`
- `job.reconciled`
- `exception.queued`
- `exception.triaged`
- `exception.replay_blocked`
- `exception.replayed`

## Reconciliation Outcomes

The baseline reconciliation worker classifies jobs as:
- `matched`
- `missing_target_record`
- `partial_delivery`
- `invalid_target_record`
- `job_not_terminal`

The worker compares terminal provisioning jobs with downstream receipt evidence when available.

Recorded reconciliation results include:
- `resultId`
- `runId`
- `jobId`
- `decisionId`
- `partnerId`
- `partnerName`
- `adapterMode`
- `jobStatus`
- `status`
- `details`
- `checkedAt`
- `escalationState`
- optional expected and received target record references

Escalation states:
- `none`
- `monitor`
- `queue_exception`

Latest reconciliation results are filterable by partner, adapter mode, status, and escalation state for operations-facing views.

## Exception Queue

The exception queue stores:
- `exceptionId`
- `jobId`
- `decisionId`
- `correlationId`
- `partnerId`
- `partnerName`
- `adapterMode`
- `jobStatus`
- `reasonCode`
- `summary`
- `escalationState`
- `status`
- timestamps
- operator notes
- triage actions with actor and timestamp
- optional `lastReplayAt`

Exceptions are queued for `missing_target_record`, `partial_delivery`, and `invalid_target_record` outcomes.

Queue listings support filters for:
- `status`
- `partnerId`
- `adapterMode`
- `reasonCode`

## Replay Rules

Replay uses the same underlying decision, application, and overlay inputs.

Replay checkpoints:
- `execute` for retry-pending jobs with remaining attempt budget and no downstream footprint
- `reconcile` when a downstream footprint or receipt already exists and a second execute would risk duplicate side effects

Replay guardrails:
- replay is blocked when the exception is not open
- replay is blocked when the job is still active
- `execute` replay is blocked after retry budget exhaustion or terminal failure
- `reconcile` replay is blocked until downstream receipt evidence is available
- blocked replay attempts record `exception.replay_blocked` audit events with explicit reasons

Operator replay behavior:
- preserves the original job idempotency key
- appends the operator note to the exception record
- records a replay triage action with actor and timestamp
- records an `exception.replayed` audit event
- marks the exception as `replayed` once reconciliation returns `matched`

## Triage Rules

Manual triage can:
- add an operator note
- update the exception status, including `resolved`
- append a timestamped triage action with actor attribution
- record an `exception.triaged` audit event
