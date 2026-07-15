# Current Phase

## Goal
Run two active tracks in parallel:
- Track A: Build the strategy-learning university integration platform MVP as a separate service.
- Track B: Continue improving the application-flow UX in the existing applicant app.

## Status Update (2026-05-24)
- Shipped parse-first tertiary transcript auto-fill in Section 2 (Track B), reusing the eligibility extraction API for form drafting and course eligibility in one save flow.

## Status Update (2026-07-01)
- Shipped program evidence review on Track B: applicant-facing transcript
  eligibility verdicts replaced with requirement-driven evidence cards, program-specific
  English proof, AHPRA evidence, and course pre-check questions on the Section 2 hub.

## Status Update (2026-07-05)
- **Shipped (PRs #193–#204):** eligibility feedback form aligned to met/review
  evidence rows; feedback persisted as `eligibility_feedback` document kind;
  hydration/reload fixes for feedback, Section 2 qualifications hub, review page,
  and all Section 1/2 form steps (`FormStepLoadingState` / `FormStepRouteFallback`);
  review UX polish (no transcript eligibility summary block; inline Section 1 Edit;
  Section 2 item-level Edit for tertiary/employment, CV Edit on document row);
  WAM calculation on evidence cards (#204).

## Status Update (2026-07-16)
- **Ready for Preview:** optional course-specific CV work-experience assessment with
  deterministic duration bounds, optional explicit role-level criteria, persisted advisory
  outcomes, role-by-role explanations, and non-blocking employer-letter attachments.
- Rollout order: additive Supabase migration first; then synthetic Preview smoke tests covering
  reassessment, hydration, document lifecycle, and successful submission without a letter;
  then Production enablement.

## Status Update (2026-03-06)
- Tuesday demo scope is complete.
- Delivery is now dual-track: integration platform buildout plus ongoing UX improvements.

## Status Update (2026-04-27)
- Start a new project stream for eligibility-check backend and document-processing layers.
- Keep this stream recommendation-focused (advisory eligibility), not admissions-decision processing.
- Use `docs/eligibility-check-roadmap.md` as the execution and contract source for this stream.

## Track C: Eligibility Check Backend (New Project)
### Objectives
- Accept transcript, optional completion certificate, and CV uploads.
- Extract and normalize user evidence into a canonical eligibility profile.
- Evaluate postgraduate program rules and return explainable eligibility results.

### Delivery Setup
- Run this as a separate project/workstream to avoid coupling with legacy application-processing assumptions.
- Keep frontend integration through explicit APIs and versioned contracts.
- Maintain frequent doc updates so agents can reconstruct intent from markdown state alone.
- Publish date-stamped stakeholder notes in `docs/stakeholder-updates/` as milestones land.

### Delivery Status (2026-06-03)
- The eligibility service is now extracted to its own repo
  ([github.com/carroll-john/eligibility-service](https://github.com/carroll-john/eligibility-service))
  and deployed on Render, talking to the app over the pinned
  [v1 contract](contracts/eligibility-evaluate.v1.md). Rules engine v1 has shipped (reason codes,
  four-status outcomes, `RULES_VERSION`). Per-environment Vercel wiring is now live and verified —
  Preview + Production both resolve to the deployed service (`ELIGIBILITY_SERVICE_URL` + token),
  `/healthz` green and token-protected; Development is intentionally unset so local dev uses the
  OpenAI fallback. Remaining: the integration-platform scaffold (Track A).

### Next 3 Tasks
1. Validate service responses against synthetic Australian transcript fixtures and tune status mapping for ambiguous GPA/English evidence cases.
2. Mitigate Render free-tier cold start (~12s) on the first user-facing eligibility call (keep-warm ping or paid plan).
3. Harden the service repo: bump `multer` 1.x → 2.x (deprecated, known vulns) and add a minimal test/lint CI workflow.

### Known Risks
- Variability in transcript formats can degrade extraction quality.
- Eligibility policy changes can outpace hardcoded logic unless rules are data-driven.
- Missing explainability can reduce user trust even when matches are technically correct.

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
1. Continue high-impact friction fixes: `DIS-10`, `DIS-11`, `DIS-9`.
2. Validate parse-first tertiary transcript flow against hosted environments and tune mapper for common AU transcript layouts.
3. Evidence card score CTA polish on the Section 2 hub (in progress on `codex/evidence-card-score-cta`).

## Known Risks: Integration Track
- Contract drift between repos if compatibility checks are not enforced in CI.
- Queue/retry/audit behavior can become brittle without clear failure taxonomy and replay rules.
- Adapter complexity can expand quickly if API/import-first sequencing is not enforced before RPA fallback work.

## Known Risks: UX Track
- UX regressions can spill into critical flow completion if shared validation and navigation contracts drift.
- Local-first cache behavior can hide backend or seeded-data issues unless tested in clean/incognito sessions.
- Piecemeal local styling can fragment interaction consistency if shared primitives are not used.
