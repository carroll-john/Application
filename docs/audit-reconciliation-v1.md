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
- `exception.replayed`

## Reconciliation Outcomes

The baseline reconciliation scanner classifies jobs as:
- `matched`
- `missing_target_record`
- `partial_delivery`
- `job_not_terminal`

The scanner uses the provisioning job status plus `targetRecordRef` to identify missing and partial downstream outcomes.

## Exception Queue

The exception queue stores:
- `exceptionId`
- `jobId`
- `correlationId`
- `reasonCode`
- `status`
- timestamps
- operator notes
- optional `lastReplayAt`

Exceptions are queued for `missing_target_record` and `partial_delivery` outcomes.

## Replay Rules

Replay uses the same underlying decision, application, and overlay inputs.

Operator replay behavior:
- preserves the original job idempotency key
- appends the operator note to the exception record
- records an `exception.replayed` audit event
- marks the exception as `replayed` once reconciliation returns `matched`
