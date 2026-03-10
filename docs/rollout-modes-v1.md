# Rollout Modes V1

This note captures the `DIS-69` coexistence rollout-mode baseline for partner course lines in the admissions workspace prototype.

## Supported modes

- `Mode 1 · Review only`
  Review, assignment, notes, and document access stay in the portal. Decision capture and downstream handoff remain outside the platform.
- `Mode 2 · Decision and export`
  Decision capture is enabled. Approved outcomes generate a structured export package for manual or partner-import handoff.
- `Mode 3 · Automated provisioning`
  Decision capture is enabled. Approved outcomes trigger the shared provisioning orchestrator and adapter route.

## Config model

Each partner-course line stores:
- `partnerId`
- `partnerName`
- `courseCode`
- `courseTitle`
- `activeMode`
- `updatedAt`
- `updatedBy`
- immutable transition history

The prototype persists rollout config locally through `PARTNER_COURSE_ROLLOUT_STORAGE_KEY` so pilot operators can change mode without code edits.

## Transition validation

Mode changes require:
- an authorized Keypath operator
- a non-empty transition reason
- a real mode change, not a no-op

Capability validation:
- `Mode 2` requires a structured export template for the partner
- `Mode 3` requires a registered university mapping overlay for the partner

Rejected changes are logged into transition history with validation errors so operators can see failed attempts as well as applied ones.

## Runtime enforcement

Decision readiness now includes rollout-mode gating:
- `Mode 1` blocks decision capture
- `Mode 2` allows decision capture and export handoff
- `Mode 3` allows decision capture and automated provisioning

Approved outcomes (`admit`, `conditional`) branch by active mode:
- `Mode 2` creates a structured export artifact and manifest
- `Mode 3` creates a provisioning job and reconciliation trace

Non-approved outcomes (`waitlist`, `reject`) stop at the immutable decision record in every mode that allows decision capture.

## Visible operations context

The admissions workspace now exposes:
- active mode on queue cards
- a rollout registry with local mode change controls
- transition history on the review workspace
- downstream trace that shows review-only boundary, export handoff, or provisioning route based on the active mode

Decision records snapshot `rolloutMode` and `downstreamAction` in metadata so later mode changes do not break historical traceability.
