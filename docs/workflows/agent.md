# Agent Workflow

## When to create a task

Automatically create a task worktree when a prompt clearly requests a code or
documentation change. The user does not need to use a special phrase. Do not
create one for questions, reviews, or read-only diagnostics.

If already inside a task worktree, continue there. Otherwise run:

```bash
npm run start-task -- "Task name"
```

The command creates a sibling worktree on `codex/<slug>` plus an ignored
`TASK.md`. Update that file when scope, acceptance criteria, or constraints
change. When the source is a Linear issue, record its URL/identifier and sync
timestamp; otherwise label the source as `prompt`.

Keep the worktree for follow-up changes. Finalise it only after merge or explicit
abandonment, from a different checkout. Never bypass a dirty-tree guard unless
the user explicitly approves `--allow-dirty`.

## Context order

1. Worktree `TASK.md`.
2. [`../system-context.md`](../system-context.md).
3. Relevant [`../domains/`](../domains/) contract.
4. Linked active decision records.
5. This workflow or a runbook only when needed.

## Commands

```bash
npm install
npm run dev                    # Vite frontend (:5173)
npm run dev:cv-parser-api      # Local /api/parse-cv (:4190)
npm run dev:suggest-api        # Local /api/suggest proxy (:4193)
supabase start                 # Local Supabase + Mailpit
npm run sync-supabase-env      # Sync .env.local from supabase status
npm test                       # Vitest unit tests
npm run build                  # tsc + vite build
npm run lint
npm run context:check
npm run start-task -- "Task name"
npm run finish-task -- "Task name"
```

## Change → Test Map

| Area changed | Run these tests |
|--------------|-----------------|
| Auth password / callback | `src/lib/authPassword.test.ts`, `src/lib/authCallback.test.ts` |
| Supabase config | `src/lib/supabase.test.ts` |
| Application storage | `src/lib/applicationStorageAdapter.test.ts`, `applicationRecords.test.ts`, `applicationRemoteStore.test.ts` |
| Documents | `src/lib/documentStorage.test.ts`, `documentUploadLimits.test.ts` |
| Validation / progress | `src/lib/applicationValidationSchema.test.ts`, `applicationValidationSchema.integration.test.ts`, `applicationProgress.test.ts`, `section1Steps.test.ts`, `section2Steps.test.ts` |
| Section 2 requirements / evidence | `src/lib/section2Requirements.test.ts`, `src/lib/eligibility/eligibilityFeedbackDocument.test.ts`, `src/lib/storage/remoteMappers.test.ts` (`findEligibilityFeedbackDocument`) |
| Document parser client / registry | `src/lib/documentParserClient.test.ts`, `documentParserRegistry.test.ts`, `cvParser.test.ts` |
| CV parser client (compat) | `src/lib/cvParserClient.test.ts` |
| CV parser API | `api/_ai/callLlm.test.ts`, `npm run test:cv-parser` (needs dev server + OPENAI_API_KEY) |
| Section 2 document save | `src/features/section2/section2DocumentSave.test.ts`, `useSection2DocumentSaveWithParse.test.ts` |
| Course catalog / eligibility | `src/lib/courseCatalog.test.ts`, `courseEligibility.test.ts`, `courseBrowse.test.ts`, `npm run eligibility:eval`, `npm run test:eligibility-transcripts` (needs `dev:transcript-eligibility-api` + `OPENAI_API_KEY`) |
| Analytics | `src/lib/posthog.test.ts`, `analyticsIdentity.test.ts` |
| Hooks (Section 1/2) | `src/hooks/*.test.ts`, `src/hooks/section1Navigation.test.ts`, `src/hooks/useSection1Step.ts` |
| Full CI parity | `npm run lint && npm test && npm run build` |

## Module Working Sets

Load only these files for typical tasks (~5–15 files each):

### auth
`src/context/AuthContext.tsx`, `src/lib/authPassword.ts`, `src/lib/authCallback.ts`, `src/features/auth/AuthPanel.tsx`, `src/features/auth/types.ts`, `src/features/auth/components/*`, `src/features/auth/screens/*`, `src/features/auth/AuthModal.tsx`, `src/features/profile/ProfilePasswordSection.tsx`, `src/pages/SignIn.tsx`, `src/pages/AuthCallback.tsx`, `src/lib/supabase.ts`

### application-state
`src/context/ApplicationContext.tsx`, `src/features/application/hooks/useApplicationData.ts`, `src/features/application/hooks/useApplicationProfile.ts`, `src/lib/applicationData.ts`, `src/lib/validation/*`

### application-persistence
`src/features/application/hooks/useApplicationStorageOrchestration.ts`, `src/features/application/hooks/useApplicationPersistence.ts`, `src/features/application/hooks/useApplicationLifecycle.ts`, `src/features/application/hooks/useApplicationSummaries.ts`, `src/features/application/hooks/useApplicationDraftImport.ts`, `src/features/application/hooks/useApplicationHydration.ts`, `src/lib/applicationStorageAdapter.ts`, `src/lib/storage/*`, `src/lib/applicantProfileStore.ts`

### documents
`src/lib/storage/documents.ts`, `src/lib/documentAttachment.ts`, `src/components/FileUpload.tsx`, `src/components/DocumentUploadField.tsx`, `api/document-delivery.ts`

### form-wizard-section1
`src/pages/Section1*.tsx`, `src/features/forms/*`, `src/features/section1/*`, `src/hooks/useSection1Step.ts`, `src/hooks/section1Navigation.ts`, `src/lib/section1Steps.ts`, `src/lib/analytics/applicationSteps.ts`, `src/hooks/useReviewReturn.ts`, `src/lib/address.ts`

### form-wizard-section2
`src/pages/Section2*.tsx`, `src/features/forms/*`, `src/features/section2/*`, `src/hooks/useEditableRecord.ts`, `src/hooks/useSection2Navigation.ts`, `src/lib/section2Steps.ts`, `src/lib/section2Requirements.ts`

### course-browse
`src/pages/CourseDetails.tsx`, `src/pages/CourseList.tsx`, `src/lib/courseCatalog.ts`, `src/lib/courseCatalog/*`, `src/lib/courseEligibility.ts`, `src/features/course/*`

### review-submit
`src/pages/ReviewAndSubmit.tsx`, `src/features/review/*`, `src/lib/reviewFormatters.ts`, `src/lib/applicationProgress.ts`

### hydration-placeholders
`src/context/ApplicationContext.tsx`, `src/features/application/hooks/useApplicationStorageOrchestration.ts`, `src/features/forms/FormStepLoadingState.tsx`, `src/features/forms/FormStepRouteFallback.tsx`, `src/features/section1/Section1StepPage.tsx`, `src/features/section2/Section2RecordPage.tsx`, `src/pages/Section2Qualifications.tsx`, `src/pages/ReviewAndSubmit.tsx`, `src/features/section2/Section2QualificationsLoadingState.tsx`, `src/features/section2/Section2QualificationsRouteFallback.tsx`, `src/features/review/ReviewLoadingState.tsx`, `src/features/review/ReviewRouteFallback.tsx`, `src/routes.tsx` (`RouteLoadingScreen`)

### document-parsing-pipeline
`api/parse-cv.ts`, `api/_documentParser/*`, `api/_ai/*`, `src/lib/documentParserClient.ts`, `src/lib/documentParserRegistry.ts`, `src/lib/documentParsers/*`, `src/features/section2/cvDocumentParsePolicy.ts`, `src/features/section2/useSection2DocumentSaveWithParse.ts`, `src/lib/analytics/cvParserAnalytics.ts`, `src/lib/analytics/tertiaryTranscriptParserAnalytics.ts`

### analytics
`src/lib/posthog.ts`, `src/lib/analytics/*`, `src/lib/sentry.ts`, `src/features/application/hooks/useApplicationAnalytics.ts`

**Eligibility feedback analytics:** `eligibility_feedback_submitted` (client, evidence
flow — see `docs/analytics-events.md`) fires from the form; `application_eligibility_feedback_saved`
fires after `saveEligibilityFeedback` persists state. Server `eligibility_check_override`
is a separate companion event.

## Parallel Agent Rules

| Module | Owns | Coordinate before touching |
|--------|------|--------------------------|
| `features/auth` | Password auth, callback, sign-in UI | Supabase RLS migrations |
| `features/application` | Context, orchestration | `api/*` |
| `features/course` | Browse, eligibility UX | `courses.raw.json` shape |
| `lib/storage` | Persistence internals | Form pages |
| `api/*` | Server routes | Vercel env vars |

## Local Dev Playbook

- **Stale Vite:** kill process on :5173, restart `npm run dev`, fresh browser tab.
- **Auth wrong locally:** confirm `supabase start`, check `.env.local`, try `npm run sync-supabase-env`.
- **Clean hosted test:** run `supabase/reset_test_data.sql`, use incognito session.
- **Schema change:** apply migration in Supabase SQL editor, regenerate types via `npm run supabase:types`.
- **Agent browser logs:** in dev, console/error output is mirrored to `.cursor/dev-console.log` via `/__dev/console`. Reproduce in the running Vite app, then read that file or `curl http://localhost:5173/__dev/console`. Clear with `curl -X DELETE http://localhost:5173/__dev/console`.
- **Dev console bridge missing:** delete stale gitignored `vite.config.js` if present — Vite prefers it over `vite.config.ts` and will skip dev-only plugins.

## CI

GitHub Actions:

- **`.github/workflows/ci.yml`** — `test-and-build` on every PR and on `master` push. `llm-regression` (CV parser + transcript eligibility LLM suites) runs only when `OPENAI_API_KEY` is set and changed paths match parser/eligibility areas; one job, path-gated. PR updates do not also trigger a duplicate `codex/**` push run.
- **`.github/workflows/eligibility-contract.yml`** — path-filtered `eligibility:eval` for branch protection (`Eligibility Contract / eligibility-contract`). Vitest contract tests run in `test-and-build`.

Details: [ci.md](ci.md).
