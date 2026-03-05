# Decisions

## 2026-03-01

### Company-domain gate for the Tuesday demo
- Use a Keypath email-domain gate on `/sign-in`.
- Restrict access to `@keypathedu.com.au` during dogfooding.
- Do not use OTP, magic-link, or a second inner applicant login flow for the current demo.

### Profile is data, not auth
- `/profile` is a reusable profile-management screen.
- Reusable profile fields are limited to email, first name, and last name.
- Profile data seeds future applications but does not continuously overwrite existing applications.

### Multi-application model
- Support multiple applications per signed-in user.
- Use one open draft per course for the Tuesday demo.

### Course catalog source of truth
- Use `src/data/courses.raw.json` plus `src/lib/courseCatalog.ts`.
- Preserve raw academic fields such as `subjectArea`, `coreSubjects`, and `recognitionOfPriorLearning`.

### Normalized catalog display
- Normalize visible course categories to `Business`, `Technology`, and `Health`.
- Normalize support labels to `CSP`, `FEE-HELP`, and `HECS-HELP`.
- Normalize fees to simple approximate figures.
- Normalize duration to year-based labels where possible.

## 2026-03-05

### Explicit document upload guardrails
- Keep the 5 MB per-file limit and add explicit remote upload quotas/rate controls.
- Enforce controls in both frontend storage logic and Supabase (`application_documents`) so future remote-primary flows remain bounded even if client checks are bypassed.
- Current remote guardrails:
  - per-application file quota: 30
  - per-application total bytes: 100 MB
  - per-user upload rate limit: 20 uploads per 10 minutes

### Enforced CSP with report collection
- Keep `Content-Security-Policy` enforced in `vercel.json` (not report-only).
- Send CSP reports to `/api/csp-report` and log normalized violations for allowlist tuning.
- Drop synthetic `example-cdn.test` payloads so rollout checks do not pollute production logs.

## 2026-03-06

### Local auth TTL and bypass hardening
- Keep company-access and local-data-owner keys in expiring storage with a 24-hour TTL.
- Keep localhost bypass in expiring storage with a 4-hour TTL.
- Restrict bypass enablement to development on `localhost` and `127.0.0.1`.

### Safe post-sign-in redirects
- Sanitize callback redirects to internal absolute paths only.
- Treat missing or unsafe redirect values as `/`.

### Shared storage-mode orchestration
- `AuthContext` is the source of truth for storage mode selection (`local` vs `remote`).
- Application state should persist through `ApplicationStorageAdapter` instead of page-level branching.

### Unified validation source
- Step progression (`next incomplete step`) and submission checks should come from one shared validation schema.
- Keep step-only vs submission-only requirements as per-rule targets, not duplicated logic trees.

### Generated Supabase typing baseline
- Generate `src/lib/supabase.types.ts` from the database schema and use it in Supabase client code.
- Prefer typed rows over manual casts in remote application/document stores.
