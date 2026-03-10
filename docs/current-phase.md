# Current Phase

## Goal
Run two active tracks in parallel:
- Track A: Build the strategy-learning university integration platform MVP as a separate service.
- Track B: Continue improving the application-flow UX in the existing applicant app.

## Status Update (2026-03-06)
- Tuesday demo scope is complete.
- Delivery is now dual-track: integration platform buildout plus ongoing UX improvements.

## Track A: Integration Platform MVP
### Objectives
- Deliver an adapter-first integration control plane with pluggable delivery adapters.
- Validate upstream admissions workspace adoption plus downstream provisioning reliability.
- Produce viability, feasibility, and desirability evidence across a 12-week pilot window.

### Delivery Setup
- Use a separate repository/service for the integration platform.
- Keep `application-prototype` decoupled from integration runtime concerns.
- Use a versioned contract boundary between repos.
- Use a modular monolith inside the new integration repository for delivery speed.
- Keep testing, deployment pipelines, and operations ownership independent per repo.

### Work Management (Linear)
- Team `Disco_Chicken`, project `Applications`, parent initiative `DIS-58`.
- Phase map:
  - Phase 1 baseline: `DIS-59`, `DIS-61`, `DIS-60`, `DIS-62`, `DIS-63`, `DIS-64`, `DIS-65`, `DIS-79`
  - Phase 2 experiments: `DIS-66`, `DIS-67`, `DIS-69`
  - Phase 3 evaluation: `DIS-68`
- Card movement rule:
  - `Backlog -> In Progress` when implementation starts.
  - `In Progress -> In Review` when code and tests are ready.
  - `In Review -> Done` after merge/deploy verification.

## Track B: Application-Flow UX Improvements
### Objectives
- Reduce completion friction across browse, eligibility, profile, form, review, and submit journeys.
- Improve clarity of requirements, CTA placement, and input ergonomics across desktop/mobile.
- Keep UX improvements aligned with shared primitives and existing form action-bar patterns.

### Delivery Setup
- Continue delivering this track in the existing `application-prototype` repository.
- Prioritize shared primitive/layout fixes over page-local one-offs.
- Keep integration touchpoints decoupled through explicit APIs/contracts.

### Work Management (Linear)
- Team `Disco_Chicken`, project `Applications`.
- Active UX backlog set:
  - `DIS-9` Prefill reusable applicant details for additional applications.
  - `DIS-10` Fix date input UX and validation across desktop/mobile.
  - `DIS-11` Remove eligibility-to-form requirement mismatches.
  - `DIS-12` Improve overview CTA placement and continuation affordances.
  - `DIS-13` Add conditional logic and rationale text for low-context questions.
  - `DIS-14` Clarify course browse filter effects and comparison displays.
  - `DIS-16` Support unit numbers and tertiary institution autocomplete.
  - `DIS-15` Explore multi-program flow options.
- Card movement rule:
  - `Backlog -> In Progress` when active implementation starts.
  - `In Progress -> In Review` when QA/validation is complete.
  - `In Review -> Done` after merge and hosted verification.

## Source Of Truth
- Integration architecture and full card map: `docs/integration-platform-mvp.md`.
- Durable app/product constraints: `docs/project-memory.md` and `docs/decisions.md`.

## Completed Milestone: Tuesday Demo
- Tuesday demo scope and acceptance criteria are complete.
- Demo completion is a baseline, not a freeze on UX iteration.

## Next 3 Tasks: Integration Track
1. Create the integration-platform repository scaffold and baseline CI pipeline.
2. Land contract baseline for `CanonicalApplicationV1`, `TransferPackageManifestV1`, `DecisionRecordV1`, and `ProvisioningJobV1` (`DIS-59`).
3. Implement orchestration skeleton and adapter lifecycle contract (`DIS-61`), then move to file export baseline (`DIS-60`).

## Next 3 Tasks: UX Track
1. Start with high-impact friction fixes: `DIS-10`, `DIS-11`, `DIS-9`.
2. Follow with navigation/clarity improvements: `DIS-12`, `DIS-13`, `DIS-14`.
3. Complete data-entry quality updates: `DIS-16`, then discovery on `DIS-15`.

## Known Risks: Integration Track
- Contract drift between repos if compatibility checks are not enforced in CI.
- Queue/retry/audit behavior can become brittle without clear failure taxonomy and replay rules.
- Adapter complexity can expand quickly if API/import-first sequencing is not enforced before RPA fallback work.

## Known Risks: UX Track
- UX regressions can spill into critical flow completion if shared validation and navigation contracts drift.
- Local-first cache behavior can hide backend or seeded-data issues unless tested in clean/incognito sessions.
- Piecemeal local styling can fragment interaction consistency if shared primitives are not used.
