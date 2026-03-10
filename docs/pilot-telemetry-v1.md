# Pilot Telemetry V1

This note captures the `DIS-80` pilot telemetry baseline for the integration MVP.

## Scope
- Define a shared metric schema for viability, feasibility, and desirability.
- Standardize admissions workspace event dimensions so pilot slices are queryable by partner, course line, rollout mode, and adapter mode.
- Add validation helpers that detect missing or malformed telemetry properties before rollups/dashboard work lands.
- Persist a local pilot event log so admissions telemetry can be queried before downstream rollup automation is implemented.
- Materialize hourly KPI rollups segmented by partner/course line and adapter mode for downstream dashboard consumption.

## Shared Event Dimensions
All pilot telemetry events in `src/lib/pilotTelemetry.ts` include:
- `pilot_schema_version`
- `pilot_surface`
- `pilot_metric_categories`
- `pilot_partner_id`
- `pilot_partner_name`
- `pilot_course_code`
- `pilot_course_title`
- `pilot_course_line_key`
- `pilot_rollout_mode`
- `pilot_actor_id_hash`

Record-level admissions events also include:
- `pilot_application_id`
- `pilot_queue_status`
- `pilot_assignment_state`
- `pilot_priority`
- `pilot_note_count`
- `pilot_provisioning_status`
- `pilot_reconciliation_status`
- `pilot_exception_state`

## Metric Catalog
### Viability
- `decision_cycle_time_hours`
  - Source: `admissions_decision_captured`
  - Query: aggregate `pilot_time_to_decision_hours` by partner, course line, and rollout mode.
- `approved_decision_handoff_rate`
  - Source: `admissions_decision_captured`
  - Query: approved decisions with `pilot_downstream_action != none` divided by all approved decisions.

### Feasibility
- `provisioning_success_rate_by_adapter`
  - Source: `admissions_decision_captured`
  - Query: decision handoffs with `pilot_provisioning_status = completed` divided by all triggered provisioning handoffs.
- `reconciliation_match_rate`
  - Source: `admissions_decision_captured`
  - Query: triggered provisioning handoffs with `pilot_reconciliation_status = matched` divided by all triggered provisioning handoffs.

### Desirability
- `weekly_active_reviewers`
  - Source: `admissions_queue_review_opened`, `admissions_decision_captured`, `admissions_document_preview_opened`, `admissions_note_added`
  - Query: unique `pilot_actor_id_hash` values over 7 days.
- `secure_document_view_success_rate`
  - Source: `admissions_document_preview_opened`, `admissions_document_preview_blocked`
  - Query: opened document previews divided by all document preview outcomes.

## Event Taxonomy
- `admissions_rollout_mode_updated`
  - Adds `pilot_previous_rollout_mode`, `pilot_rollout_update_outcome`, `pilot_rollout_reason_provided`, `pilot_rollout_transition_count`.
- `admissions_queue_review_opened`
  - Uses shared record dimensions only.
- `admissions_queue_assignment_updated`
  - Adds `pilot_assignment_action`.
- `admissions_decision_captured`
  - Adds `pilot_decision_outcome`, `pilot_decision_reason_code`, `pilot_downstream_action`, `pilot_adapter_mode`, `pilot_provisioning_triggered`, `pilot_time_to_decision_hours`, `pilot_time_to_decision_source`.
- `admissions_document_preview_opened`
  - Adds `pilot_document_access_outcome`, `pilot_document_category`, `pilot_document_id`.
- `admissions_document_preview_blocked`
  - Adds `pilot_document_access_outcome`, `pilot_document_access_reason`, `pilot_document_category`, `pilot_document_id`.
- `admissions_status_updated`
  - Adds `pilot_previous_queue_status`, `pilot_status_target`.
- `admissions_note_added`
  - Uses shared record dimensions only.

## Data Quality Checks
`validatePilotTelemetryEvent` and `validatePilotTelemetryBatch` enforce:
- required property presence
- non-empty string properties
- finite numeric properties
- enum validation for rollout mode, queue status, downstream action, document outcome, and related controlled fields

`buildPilotTelemetryCoverageReport` adds flow-level checks for:
- queue activity coverage
- decision capture coverage
- secure document-view coverage
- handover/note coverage
- schema validation coverage

## Query Helpers
`src/lib/pilotTelemetry.ts` now persists events to `application-prototype:pilot-telemetry:v1` and exposes:
- `loadPilotTelemetryEvents`
- `listPilotTelemetryEvents`
- `buildAdmissionsPilotTelemetrySummary`
- `buildPilotTelemetryCoverageReport`

The admissions workspace uses those helpers to render a compact telemetry snapshot for the currently filtered cohort:
- events logged
- weekly active reviewers
- decision-event count
- median time to decision
- coverage/validation status

## Automated Rollups
`src/lib/pilotTelemetryRollups.ts` now:
- persists hourly rollup snapshots to `application-prototype:pilot-telemetry-rollups:v1`
- groups KPI slices by partner, course line, and adapter mode
- records source fingerprint and schedule metadata for each rollup window
- validates stored rollups back against the source event log before marking them consistent

The admissions workspace now exposes the latest automated rollup run with:
- last run and next scheduled run
- source event count
- consistency status
- segmented KPI cards for partner/adaptor combinations

These helpers are the gate for later dashboard and checkpoint-report work in `DIS-101`, `DIS-112`, and `DIS-113`.
