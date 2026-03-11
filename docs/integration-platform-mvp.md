# Strategy-Learning MVP: University Integration Platform

## Snapshot (2026-03-06)
- Build an adapter-first university integration layer as a separate product surface.
- Keep applicant-facing flow delivery moving in parallel in the existing `application-prototype` repo.
- Run a 12-week MVP with 2-3 diverse universities.

## Product Goal
- Validate whether an upstream admissions workspace plus deterministic downstream provisioning reduces manual SIS re-entry effort more than downstream-only optimization.

## Explicit Success Framework
- Viability:
  - Manual touch rate reduction.
  - Throughput improvement at equivalent staffing.
  - Time-to-decision reduction.
- Feasibility:
  - Provisioning success by adapter mode.
  - Mapping accuracy and change resilience.
  - Reconciliation integrity and operational load.
- Desirability:
  - Active admissions usage.
  - Willingness to keep decisioning in-platform.
  - Workflow friction and blocker patterns.

## Target Design
- Integration control plane:
  - Canonical schema and mapping registry.
  - Orchestration with idempotency, retries, and reconciliation.
  - Evidence-grade audit ledger and compliance controls.
  - Secure document packaging and transfer controls.
- Pluggable adapters:
  - `ApiAdapter`
  - `FileAdapter`
  - `ImportWorkflowAdapter`
  - `PortalRpaAdapter`
  - `EdgeConnectorAdapter`
- Upstream admissions workspace:
  - Queue, assignment, review, and decision capture.
  - Decision-to-provisioning trigger and status visibility.

## Required Contracts
- Types:
  - `CanonicalApplicationV1`
  - `TransferPackageManifestV1`
  - `DecisionRecordV1`
  - `ProvisioningJobV1`
- Adapter lifecycle contract:
  - `prepare -> execute -> verify -> reconcile`
- API surface:
  - `POST /decisions`
  - `POST /provisioning/jobs`
  - `GET /provisioning/jobs/{id}`
  - `GET /reconciliation/exceptions`
  - `POST /mapping-profiles/{id}/promote`

## Delivery Architecture Recommendation
- System boundary:
  - New repository and deployable service for the integration platform.
  - Existing repository remains focused on applicant UX and form flow.
- Internal shape:
  - Modular monolith in the new integration repository.
  - Decoupled boundary between repos via versioned API/event contracts.
- Coupling guardrails:
  - No shared database tables between repos.
  - Idempotency keys and correlation IDs across handoff and provisioning events.

## Testing And Environments
- Test strategy:
  - Unit tests per module.
  - Integration tests for orchestration, adapter execution, and reconciliation.
  - Contract tests between `application-prototype` and integration APIs.
  - Adapter fixture tests for failure classes and retry behavior.
- Environments:
  - `local`, `dev`, `staging`, `pilot-prod`, `prod`.
- CI/CD:
  - Independent pipelines and deployment cadence per repository.
  - Contract compatibility checks in CI to prevent breaking interface changes.

## Evaluation Baseline
- Pilot telemetry schema and event taxonomy:
  - `docs/pilot-telemetry-v1.md`
- This baseline feeds:
  - segmented admissions/desirability instrumentation
  - rollup automation
  - pilot evaluation dashboard
  - pilot checkpoint templates
  - recommendation dashboard work

## Ownership Model
- Keep current team shipping core application flow in the existing repo.
- Build integration platform in a dedicated repo with independent code ownership.
- Keep future team split simple by service boundary rather than by internal module extraction.

## Linear Work Map (Team: Disco_Chicken, Project: Applications)
- Initiative parent:
  - `DIS-58` Strategy-learning MVP.
- Phase 1 baseline (Weeks 1-4):
  - `DIS-59` Canonical schemas.
  - `DIS-61` Orchestration and adapter contract.
  - `DIS-60` Structured file export and manifests.
  - `DIS-62` Audit ledger, reconciliation, exception queue.
  - `DIS-63` Import workflow and edge connector scaffolds.
  - `DIS-64` Admissions workspace queue/review/document view.
  - `DIS-65` Decision capture and provisioning trigger.
  - `DIS-79` Partner-course rollout mode config.
- Phase 2 experiments (Weeks 5-8):
  - `DIS-66` AI-assisted mapping and discovery.
  - `DIS-67` Deterministic RPA fallback.
  - `DIS-69` Coexistence rollout modes.
- Phase 3 evaluation (Weeks 9-12):
  - `DIS-68` Pilot telemetry and recommendation output.

## Execution Rules
- Move each card as it progresses:
  - `Backlog -> In Progress` when active implementation starts.
  - `In Progress -> In Review` after code and tests are ready.
  - `In Review -> Done` after merge/deploy verification.
- Keep a tight active set and avoid broad WIP across many cards at once.
