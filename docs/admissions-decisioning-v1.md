# Admissions Decisioning V1

This note captures the `DIS-65` admissions decisioning baseline in the prototype workspace.

Rollout-mode coexistence behavior is documented separately in `docs/rollout-modes-v1.md`.

## Decision outcomes

Supported reviewer outcomes:
- `admit`
- `conditional`
- `waitlist`
- `reject`

Every captured outcome creates an immutable `DecisionRecordV1` with:
- reviewer attribution (`decidedBy`)
- timestamp (`decidedAt`)
- partner/application identifiers
- structured `reasonCode`
- optional reviewer notes

## Readiness rules

Decision capture is enabled only when all of the following are true:
- the active rollout mode allows decision capture
- queue status is `ready-for-decision`
- the application is assigned to the active reviewer
- structured evidence references resolve to attached admissions documents
- no provisioning run is already active for the record

## Queue status progression

Pre-decision workflow:
- `new`
- `assigned`
- `under-review`
- `ready-for-decision`

Post-decision workflow:
- `decisioned` for `waitlist` and `reject`
- `provisioning` when an approved outcome has started but not settled
- `provisioned` when the downstream job completes and reconciles cleanly
- `provisioning-exception` when the triggered job ends in failure/exception

## Provisioning trigger rule

Only approved outcomes trigger downstream automation:
- `admit`
- `conditional`

The active rollout mode decides whether those approved outcomes create:
- a structured export handoff (`Mode 2`)
- an automated provisioning job (`Mode 3`)

`waitlist` and `reject` stop at the immutable decision record and do not create downstream automation.

## Visible trace

The review workspace now exposes:
- decision history
- latest provisioning job metadata
- adapter route and correlation id
- reconciliation result
- immutable provisioning audit events
- open exception summary when present
