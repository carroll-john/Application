# Memory: Applications

## Model

- Multiple applications per signed-in user.
- One open draft per course; submitted applications kept separately.
- Selected course stored in `applicationMeta.selectedCourse` — never implicit/hard-coded.
- Eligibility is course-specific; no direct apply shortcut bypassing eligibility on course pages.

## State Layer

- `ApplicationContext` — shared application state (facade over hooks in `src/context/application/` or `src/features/application/`).
- `AuthContext` selects `storageMode` (`local` vs `remote`).
- `ApplicationStorageAdapter` — single persistence contract; pages must not branch local vs remote.
- Types and merge helpers: `src/lib/applicationData.ts`.

## Validation

- Single schema: `src/lib/applicationValidationSchema.ts` for step completion and submission readiness.
- Section 2 submission rule: at least one tertiary qualification **or** both CV and employment experience.
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

## Submission

- Server-backed submit via `submit_application` RPC (`0002_server_submit.sql`, `0004_submission_rpc_grants.sql`).
- Do not move application-number generation back to client-only code.
- `application_submission_missing_fields` enforces the conditional requirements
  above (migrations `20260620120000_conditional_submission_requirements.sql` and
  `20260701090000_program_evidence_validation.sql`). It reads
  `applications.requires_english_proficiency`,
  `applications.english_proficiency_policy`, language-test scores/documents, and
  `tertiary_qualifications.transcript_confirms_completion`; the app writes the
  course-derived signals at save time in `src/lib/storage/remoteMappers.ts` /
  `remoteStore.ts`.
  The AHPRA regex and English-medium-country list are duplicated in SQL there —
  **keep them in sync** with `englishProficiencyEvidence.ts`.
- **Gotcha — editing the submit RPC:** rebuild `application_submission_missing_fields`
  from its *current* definition (`pg_get_functiondef` or the latest migration that
  touched it: `20260522120000_storage_quota_and_document_integrity.sql`), never from
  `0002`. Later migrations dropped the `is_allowed_company_user()` guard and switched
  every document check to `application_document_is_ready()`; rebuilding from `0002`
  silently reverts both (a prod-breaking regression caught in PR #129).
- **Gotcha — eligibility request context has two definitions** that must stay in
  sync: the client builder `buildTranscriptEligibilityContext`
  (`src/features/section2/tertiaryTranscriptParsePolicy.ts`) and the API whitelist
  parser `parseContext` (`api/_eligibility/context.ts`). A field added to one but
  not the other is silently dropped before reaching the evaluator in the real upload
  flow (caught in PR #130).

## Course Catalog

- Source: `src/data/courses.raw.json` → `src/lib/courseCatalog.ts` (public barrel).
- Implementation lives in `src/lib/courseCatalog/`: `buildCatalog.ts` (catalog assembly), `normalize.ts` (orchestrator mapping a raw entry to a `CourseCatalogEntry`), and focused parsers — `fees.ts`, `duration.ts`, `intake.ts`, `inference.ts`, `entryRequirements.ts`, `text.ts`. Behavior is locked by `normalize.test.ts`.
- Preserve raw academic fields; normalize display labels per `project-memory.md`.

## Key Files

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
| `src/lib/validation/rules/section2.ts` | Section 2 submission rules incl. the conditional requirements |
| `src/pages/ReviewAndSubmit.tsx` | Review + submit |

## Agent Module Boundary

Owns: context hooks, orchestration, adapter calls, validation schema consumers.
Coordinate before changing: Supabase RLS migrations, `api/*` routes.
