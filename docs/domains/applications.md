---
schema_version: 1
document_type: domain_contract
domain: applications
status: active
owner: src/context/ApplicationContext.tsx
---

# Applications Domain

## Owner

`ApplicationContext` and its focused hooks own application orchestration.
`ApplicationData` owns the domain shape, `ApplicationStorageAdapter` owns the
persistence boundary, and the server submit contract owns the final transition.

## Current contract

### Brand-specific catalogues

- StudyNext and University of Canberra catalogues are separate committed snapshots selected through the active brand configuration.
- Catalogue consumers may request a specific `CatalogId` for contract tests; runtime consumers use the active brand catalogue.
- UC entries retain source URL, verification date, delivery mode and an explicit `assess` or `manual_review` policy.
- UC requirements without reviewed matcher-safe rules never fall back to inferred legacy admission logic. They proceed as an application requiring admissions review.
- The UC pre-application course matcher ranks from the applicant's full reviewed CV. Current or most recent included roles carry more weight than older roles, while completed tertiary qualifications demote equivalent or lower-level study in the same field so recommendations favour additive learning. This ranking is advisory and does not replace course-specific entry, credit or admissions review.
- On the UC matched-course screen, applicants shortlist exactly three courses before starting a credit comparison. The comparison requires authentication, processes one transcript ephemerally, combines extracted study evidence with the reviewed CV match, and does not create an application draft. Indicative credit, duration and tuition comparisons remain separate from admission and from UC's formal faculty decision.

- Multiple applications per signed-in user.
- One open draft per course; submitted applications kept separately.
- Selected course stored in `applicationMeta.selectedCourse` — never implicit/hard-coded.
- Eligibility is course-specific; no direct apply shortcut bypassing eligibility on course pages.
- `eligibilityFeedbackDocument` / `eligibilityFeedbackFileName` on `ApplicationData` —
  optional JSON feedback artifact; hydrate from latest `application_documents` row with
  `kind = eligibility_feedback` (see [documents.md](documents.md)).
- `workExperienceAssessments` is a versioned map keyed by course requirement ID. Employment
  roles may each reference one optional `employment_letter` document.

## State Layer

- `ApplicationContext` — shared application state (facade over hooks in `src/context/application/` or `src/features/application/`).
- `ApplicationContext` creates `ApplicationStorageAdapter` from the authenticated
  session. Signed-out users receive a no-write guest adapter.
- `ApplicationStorageAdapter` is the single persistence contract; pages must not
  import stores or branch storage modes.
- Types and merge helpers: `src/lib/applicationData.ts`.

## Validation

- Single schema: `src/lib/applicationValidationSchema.ts` for step completion and submission readiness.
- Section 2 submission rule: course-specific overlay from `section2Requirements.ts`.
  The legacy fallback is at least one tertiary qualification **or** both CV and
  employment experience; current remote drafts persist a course-derived
  `applications.section2_submission_policy` snapshot so the submit RPC can enforce
  minimum education rank, secondary-qualification support, and experience alternatives.
- Tertiary documents are submission-gated, not save-gated.
- Course-specific Section 2 overlay: `src/lib/section2Requirements.ts`.

### Conditional ("optional hard") submission requirements

Two submission requirements fire only when actually needed. The shared logic lives
in `src/lib/eligibility/englishProficiencyEvidence.ts`; client rules in
`src/lib/validation/rules/section2.ts` surface them at review/submit, and the
server `submit_application` RPC enforces the same conditions (see Submission).

- **Certificate of Completion** — required only when a qualification is marked
  `completed` **and** its transcript can't evidence completion
  (`needsCertificateOfCompletion`). The transcript signal comes from the parsed
  `transcriptEligibility` (in-memory) and is persisted to
  `tertiary_qualifications.transcript_confirms_completion` so it survives reloads
  (`TertiaryQualification.transcriptCompletionConfirmed`).
- **English proficiency** — required only when the course declares an
  `english_proficiency` requirement, it can't be inferred from an accepted
  English-medium-country qualification, **and** no approved evidence is present
  (`needsEnglishProficiencyEvidence`). Approved evidence is now program-specific:
  an English test must have a ready score-report document and scores meeting the
  selected program's generated requirement; AHPRA evidence must be recognised by
  name, marked `Active`, and have a ready supporting document.

### Eligibility feedback (applicant disputes)

- Saved via `saveEligibilityFeedback` in `ApplicationContext` →
  `useApplicationData.saveEligibilityFeedbackDocument`.
- Payload builder: `src/lib/eligibility/eligibilityFeedbackDocument.ts`
  (`ELIGIBILITY_FEEDBACK_SCHEMA_VERSION`, `eligibility-feedback.json`).
- UI: `SupportingEvidencePanel` + `EligibilityFeedbackForm` on the qualifications hub.
- Remote load: `findEligibilityFeedbackDocument` in `remoteMappers.ts` over the
  documents query — do not assume `applications.eligibility_feedback_*` columns
  are populated on read.

### Advisory work-experience evidence

- CV parsing drafts editable employment rows; it does not decide whether a program's work
  requirement is met. `useWorkExperienceAssessment` separately evaluates only courses that
  declare a `work_experience` requirement and persists results by requirement ID.
- `relevantTo` means field/type of work only. Course-specific managerial, supervisory,
  professional, leadership, or people-management wording belongs in optional
  `qualifyingRoleCriteria`; do not infer a universal role-level ladder.
- Calendar duration is deterministic, overlapping roles are merged, current roles end in the
  current month, and year-only dates yield minimum/maximum bounds. Part-time/FTE weighting is
  deliberately out of scope.
- Outcomes are conditional evidence signals (`provisionally_met`, `possibly_met`,
  `not_demonstrated`, `needs_review`), never final admissions decisions. Employer letters are
  optional corroborating evidence and never submission blockers.

## Submission

- Server-backed submit via `submit_application` RPC (`0002_server_submit.sql`, `0004_submission_rpc_grants.sql`).
- Do not move application-number generation back to client-only code.
- `application_submission_missing_fields` enforces the conditional requirements
  above (migrations `20260620120000_conditional_submission_requirements.sql` and
  `20260701090000_program_evidence_validation.sql`). It reads
  `applications.requires_english_proficiency`,
  `applications.english_proficiency_policy`,
  `applications.section2_submission_policy`, language-test scores/documents, and
  `tertiary_qualifications.transcript_confirms_completion`; the app writes the
  course-derived signals at save time in `src/lib/storage/remoteMappers.ts` /
  `remoteStore.ts`.
  The AHPRA regex and English-medium-country list are intentional SQL mirrors of
  the eligibility-rules package and are protected by
  `submitPolicyContract.test.ts`.
- **Gotcha — editing the submit RPC:** rebuild `application_submission_missing_fields`
  from its *current* definition (`pg_get_functiondef` or the latest migration that
  touched it: `20260522120000_storage_quota_and_document_integrity.sql`), never from
  `0002`. Later migrations dropped the `is_allowed_company_user()` guard and switched
  every document check to `application_document_is_ready()`; rebuilding from `0002`
  silently reverts both (a prod-breaking regression caught in PR #129).
- Work-experience assessments and employer letters are deliberately absent from the submit
  RPC. Do not add them to `application_submission_missing_fields` without a new product and
  admissions policy decision.
- **Eligibility rules package:** `@johncarroll/eligibility-rules` at
  `vendor/eligibility-rules` is the authoritative Applications-owned rules source.
  The proxy owns final verdict assembly; the package owns matcher, requirement
  types, v2 pathway IR, evaluators, check copy, assessment resolution, and
  submit-policy constants. App shims under `src/lib/eligibility/*.ts` re-export
  from the package so existing imports keep working. An independent copy still
  exists in the service repository pending Phase 3 removal; do not edit it as an
  alternative authority.
- **Pathway result contract:** matcher assessments expose `selectedPathwayId` plus
  per-pathway summaries. Applicant-facing evidence rows must render global
  requirements and the selected pathway only; never combine failing checks from
  mutually exclusive entry levels. When no pathway passes, select the closest
  pathway deterministically (fewest failures, then most passes, then fewest
  unknowns, then catalog order) so the next evidence request is actionable.
- **Qualification identity:** `qualification_completed` may constrain
  `requiredQualificationName` and `requiredProvider`. Use
  `qualification_level.params.completedRequired = true` when the published rule
  requires a completed degree at or above a level; this avoids a redundant generic
  completion check while still enforcing completion.
- **Transcript eligibility context:** one shared schema in the package
  (`contextSchema.ts`: `parseTranscriptEligibilityContext`,
  `serializeTranscriptEligibilityContext`). The Section 2 client builder
  (`buildTranscriptEligibilityContext` in `tertiaryTranscriptParsePolicy.ts`) and
  the API parser (`parseContext` in `api/_eligibility/context.ts`) must stay
  aligned with that schema — add fields to the package parser first, then the
  builder. Contract test: `src/lib/eligibility/contextSchema.test.ts`.
- **Submit policy drift guard:** English-medium country aliases, AHPRA regex, and
  transcript-completion patterns live in the package `submitPolicy.ts`. SQL RPC
  checks in `20260707120000_section2_submission_policy.sql` must match — contract
  test: `src/lib/eligibility/submitPolicyContract.test.ts`.
- **Academic thresholds:** when a transcript has no aggregate WAM but exposes unit
  marks and credit points, calculate WAM deterministically from all counted unit
  rows (`sum(mark * creditPoints) / sum(creditPoints)`). Include failed subjects
  with numeric marks; exclude blank-mark pass/fail-only, withdrawn, RPL/exemption,
  advanced-standing, and credit-transfer rows. Use GPA-to-percent mapping only as
  a last fallback when no aggregate or unit-derived WAM exists.

## Course Catalog

- Source: `src/data/courses.raw.json` → `src/lib/courseCatalog.ts` (public barrel).
- Implementation lives in `src/lib/courseCatalog/`: `buildCatalog.ts` (catalog assembly), `normalize.ts` (orchestrator mapping a raw entry to a `CourseCatalogEntry`), and focused parsers — `fees.ts`, `duration.ts`, `intake.ts`, `inference.ts`, `entryRequirements.ts`, `text.ts`. Behavior is locked by `normalize.test.ts`.
- Preserve raw academic fields; normalize display labels per
  [`system-context.md`](../system-context.md).

### Course eligibility requirements (offline parser)

- **Source text:** `entry_requirements` in `courses.raw.json`.
- **Structured IR:** `CourseRequirementsV2` (`global` + `pathways[]`) in
  `@johncarroll/eligibility-rules` (re-exported from `src/lib/eligibility/courseRequirementsV2.ts`); flattened to `RequirementInstance[]`
  with `pathwayBundleId` at runtime via `requirementsLoader.ts`.
- **Generated artifact:** `src/lib/courseCatalog/requirements.generated.json` (committed,
  PR-reviewed). v2 pathway IR replaces the old flat list for multi-pathway courses.
- **Parser pipeline:** `scripts/courseRequirementsParser/pipeline.ts`
  (segment → classify → structure → validate → repair). Entry point:
  `npm run eligibility:parse-requirements`.
- **Academic metric safety:** a percentage threshold followed by “or equivalent
  GPA” is one WAM/percentage requirement unless the source publishes a numeric GPA
  value and scale. Never synthesize values such as `60 GPA`.
- **Golden eval corpus:** `tests/fixtures/course-requirements/` + manifest.
  CI gate: `npm run eligibility:parse-eval` (structure + safety; leaf recall ≥ 0.8).
- **Human review pack:** `npm run eligibility:review:open` writes
  `reports/course-requirements-review/index.html` — side-by-side “website text” vs
  “how we interpreted it”, with per-course correction notes (saved in browser localStorage).
- **Kind registry:** `src/lib/eligibility/requirementKindRegistry.ts` — single place
  for parser prompt fragments, evidence source, and evaluator dispatch.
- **Override improvement loop:** `npm run eligibility:dump-overrides` → review
  PostHog `eligibility_check_override` events → promote disagreements to golden
  fixtures (`npm run eligibility:build-golden`) → tune parser prompt/registry →
  re-run `eligibility:parse-eval` before merging requirement changes.

## Approved entry points

| File | Role |
|------|------|
| `src/context/ApplicationContext.tsx` | Provider facade |
| `src/features/application/hooks/useApplicationData.ts` | CRUD mutators |
| `src/features/application/hooks/useApplicationStorageOrchestration.ts` | Hydration, begin app, submit |
| `src/features/application/hooks/useApplicationPersistence.ts` | `persistApplication`, `ensureRemoteRecordId`, `ensureApplicationRow` |
| `src/lib/applicationStorageAdapter.ts` | Storage contract |
| `src/lib/applicationRecords.ts` | Local record helpers |
| `src/lib/applicationRemoteStore.ts` | Supabase persistence |
| `src/lib/eligibility/englishProficiencyEvidence.ts` | Conditional cert + English-proficiency helpers (client + server share the rules) |
| `src/lib/eligibility/eligibilityFeedbackDocument.ts` | Feedback JSON document kind + save helper |
| `src/lib/validation/rules/section2.ts` | Section 2 submission rules incl. the conditional requirements |
| `src/pages/ReviewAndSubmit.tsx` | Review + submit |
| `src/pages/Section2Qualifications.tsx` | Evidence hub + feedback entry |

## Forbidden shortcuts

- Page-level persistence calls or local/remote branches.
- Client-only submission rules without a matching server contract.
- Program eligibility decisioning in `eligibility-service`.
- A second eligibility-rules implementation outside the Applications-owned package.
- Rebuilding the submit RPC from an obsolete migration.

## Intentional mirrors

- Client submission validation mirrors the authoritative server submit gate for UX.
- SQL copies of English-country/AHPRA values mirror the package because SQL cannot
  import TypeScript; `submitPolicyContract.test.ts` checks them.
- Generated course requirements mirror reviewed catalog source text and are
  protected by the parser evaluation corpus.

## Required checks

- Application persistence: `applicationStorageAdapter.test.ts`,
  `applicationRecords.test.ts`, and `applicationRemoteStore.test.ts`.
- Validation/submission: validation integration tests,
  `section2Requirements.test.ts`, and `submitPolicyContract.test.ts`.
- Eligibility rules/context: eligibility unit tests, `contextSchema.test.ts`,
  `npm run eligibility:eval`, and `npm run eligibility:parse-eval` as applicable.
- Coordinate Supabase migrations and `api/*` changes through the relevant runbook
  and contract tests.

## Related decisions

- [ADR-0001: Authenticated Applicant Data](../decisions/0001-authenticated-applicant-data.md)
- [ADR-0002: Server-Authoritative Submission](../decisions/0002-server-authoritative-submission.md)
- [ADR-0003: Eligibility Ownership](../decisions/0003-eligibility-ownership.md)
