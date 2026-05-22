# Memory: Agent Workflow

## Commands

```bash
npm install
npm run dev                    # Vite frontend (:5173)
npm run dev:cv-parser-api      # Local /api/parse-cv (:4190)
supabase start                 # Local Supabase + Mailpit
npm run sync-supabase-env      # Sync .env.local from supabase status
npm test                       # Vitest unit tests
npm run build                  # tsc + vite build
npm run lint
npm run start-task -- "Task name"
npm run finish-task -- "Task name"
```

## Change → Test Map

| Area changed | Run these tests |
|--------------|-----------------|
| Auth OTP / callback | `src/lib/authOtp.test.ts`, `src/lib/authCallback.test.ts` |
| Supabase config | `src/lib/supabase.test.ts` |
| Application storage | `src/lib/applicationStorageAdapter.test.ts`, `applicationRecords.test.ts`, `applicationRemoteStore.test.ts` |
| Documents | `src/lib/documentStorage.test.ts`, `documentUploadLimits.test.ts` |
| Validation / progress | `src/lib/applicationValidationSchema.test.ts`, `applicationValidationSchema.integration.test.ts`, `applicationProgress.test.ts`, `section1Steps.test.ts`, `section2Steps.test.ts` |
| Section 2 requirements | `src/lib/section2Requirements.test.ts` |
| CV parser client | `src/lib/cvParserClient.test.ts`, `cvParser.test.ts` |
| CV parser API | `api/_ai/callLlm.test.ts`, `npm run test:cv-parser` (needs dev server + OPENAI_API_KEY) |
| Course catalog / eligibility | `src/lib/courseCatalog.test.ts`, `courseEligibility.test.ts`, `courseBrowse.test.ts` |
| Analytics | `src/lib/posthog.test.ts`, `analyticsIdentity.test.ts`, `clarity.test.ts` |
| Hooks (Section 1/2) | `src/hooks/*.test.ts`, `src/hooks/section1Navigation.test.ts` |
| Full CI parity | `npm run lint && npm test && npm run build` |

## Module Working Sets

Load only these files for typical tasks (~5–15 files each):

### auth
`src/context/AuthContext.tsx`, `src/lib/authOtp.ts`, `src/lib/authCallback.ts`, `src/features/auth/*`, `src/pages/SignIn.tsx`, `src/pages/AuthCallback.tsx`, `src/lib/supabase.ts`

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

### cv-ai-pipeline
`api/parse-cv.ts`, `api/_ai/*`, `src/lib/cvParser.ts`, `src/lib/cvParserClient.ts`, `src/lib/cvEmployment/*`

### analytics
`src/lib/posthog.ts`, `src/lib/analytics/*`, `src/lib/clarity.ts`, `src/lib/sentry.ts`, `src/features/application/hooks/useApplicationAnalytics.ts`

## Parallel Agent Rules

| Module | Owns | Coordinate before touching |
|--------|------|--------------------------|
| `features/auth` | OTP, callback, sign-in UI | Supabase RLS migrations |
| `features/application` | Context, orchestration | `api/*` |
| `features/course` | Browse, eligibility UX | `courses.raw.json` shape |
| `lib/storage` | Persistence internals | Form pages |
| `api/*` | Server routes | Vercel env vars |

## Local Dev Playbook

- **Stale Vite:** kill process on :5173, restart `npm run dev`, fresh browser tab.
- **Auth wrong locally:** confirm `supabase start`, check `.env.local`, try `npm run sync-supabase-env`.
- **Clean hosted test:** run `supabase/reset_test_data.sql`, use incognito session.
- **Schema change:** apply migration in Supabase SQL editor, regenerate types via `npm run supabase:types`.

## CI

GitHub Actions (`.github/workflows/ci.yml`): lint → test → build on PR/push. Optional CV parser regression when `OPENAI_API_KEY` secret is set.
