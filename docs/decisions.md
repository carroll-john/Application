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

## 2026-05-22

### Document storage and submission integrity
- Enforce upload quotas on `storage.objects` inserts (not only `application_documents`) so direct Storage API uploads cannot bypass limits.
- Require `application_documents` rows to reference an existing storage object before insert.
- Server submission checks use `application_document_is_ready()` (document row + storage object); file-name-only placeholders no longer satisfy submit.

## 2026-03-05

### Explicit document upload guardrails
- Keep the 5 MB per-file limit and add explicit remote upload quotas/rate controls.
- Enforce controls in frontend storage logic, `application_documents` triggers, and `storage.objects` triggers so client bypasses remain bounded.
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

### Strategy-learning integration platform boundary
- Build the university integration platform in a separate repository/service from the current applicant app.
- Keep the existing `application-prototype` repository focused on applicant UX and form journey delivery.
- Use a decoupled system boundary with versioned contracts and APIs/events rather than shared database tables.

### Integration architecture shape
- Use a modular monolith inside the new integration repository for early delivery speed.
- Keep API and worker runtime surfaces independently deployable within that repository.
- Standardize adapter lifecycle to `prepare -> execute -> verify -> reconcile`.
- Keep API/import/file delivery baseline mandatory; treat portal RPA as optional fallback.

### Integration delivery and ownership model
- Keep CI/CD, environments, and release cadence independent between the applicant app and integration platform.
- Use contract compatibility checks to prevent cross-repo breaking changes.
- Keep ownership boundaries service-level so a dedicated team can adopt the integration platform without splitting the applicant app.

### Linear execution model for this initiative
- Track this initiative under `DIS-58` (Team `Disco_Chicken`, Project `Applications`).
- Execute baseline first: schema/contracts, orchestration, file export, audit/reconciliation, then workspace decisioning.
- Move cards as work progresses: `Backlog -> In Progress -> In Review -> Done`.

### Tuesday demo completion and dual-track execution
- Tuesday demo scope is considered complete as of 2026-03-06.
- Execute two active tracks in parallel:
  - integration platform MVP (`DIS-58` and children) in a separate repository/service
  - continued applicant-flow UX improvements in the existing `application-prototype` repo
- Treat demo completion as a baseline milestone, not a freeze on UX iteration.

## 2026-04-27

### Eligibility check is a distinct project stream
- The next build stream is an eligibility-check flow, not a full admissions processing system.
- Primary user objective is to learn eligible postgraduate programs from uploaded evidence.

### Required document set for eligibility evaluation
- Transcript is required.
- Certificate of completion is conditionally required when completion status is not clear in transcript evidence.
- CV is included in the core evidence set for eligibility matching.

### Explainable advisory outcomes
- Eligibility results are advisory and must return transparent reasons.
- Each program result should include status, reason codes, and missing requirements.
- Use explicit fallback status (`insufficient_data`) when extraction confidence is low or required evidence is missing.

### Documentation cadence as project control plane
- Markdown docs are the shared memory layer for agent continuity.
- Every scope/contract/policy change must be documented in the same PR as implementation.
- `docs/eligibility-check-roadmap.md` is the active scope and architecture ledger for this project stream.

### Stakeholder update notes
- Publish date-stamped stakeholder updates in `docs/stakeholder-updates/`.
- Format updates for easy paste into Notion/chat with: what shipped, what is next, feedback request, and see/play links.

## 2026-05-20

### Restore real Supabase Auth via magic-link
- Supersedes the 2026-03-01 decision to avoid OTP/magic-link. The Tuesday demo
  is long complete, and the localStorage-only email gate provided no
  server-verifiable identity — so `/api/parse-cv`, the document delivery proxy,
  and Supabase RLS had no real caller identity to enforce against.
- `/sign-in` now sends a Supabase magic-link (`signInWithOtp`). `AuthContext`
  tracks the live Supabase session via `getSession` + `onAuthStateChange`.
- The company email-domain gate still applies: enforced client-side against the
  session email and server-side by the `is_allowed_company_user()` RLS policy.
  A signed-in session whose email is outside the allowed domains is signed out.
- The localhost-only dev bypass is unchanged.
- Restoring auth does NOT by itself move applicant data off the client.
  `storageMode` deliberately stays `local` for now; activating remote (Supabase)
  draft persistence is a separate change that should follow a remote-store
  integration test.

### Public applicant auth via email OTP
- Supersedes the remaining company-domain gate in the 2026-05-20 magic-link
  decision. Applicant access is no longer Keypath-only.
- `/sign-in` now uses a unified Supabase email one-time-code flow for both
  sign up and sign in. The email template must use `{{ .Token }}` so users can
  verify the code in-app.
- Auth can be initiated from the header, from eligibility completion before the
  result is shown, and from apply actions before an application is started.
- Signed-in users use remote Supabase profile/application/document storage;
  anonymous users can still browse and keep pre-auth draft state locally.
- Applicant RLS now relies on `auth.uid()` ownership checks instead of
  `is_allowed_company_user()` or `allowed_email_domains`.

### Public applicant auth via email + password
- Supersedes the 2026-05-20 public email OTP decision.
- `/sign-in` now uses Sign in and Create account tabs with Supabase
  `signInWithPassword` and `signUp`.
- New accounts require email confirmation before first sign-in. Sign-up passes
  `emailRedirectTo` to `/auth/callback?redirect=…` so confirmed users return to
  the intended in-app path.
- Auth can still be initiated from the header, eligibility completion, and apply
  actions before an application is started.
- Signed-in users continue to use remote Supabase profile/application/document
  storage; anonymous users can browse and keep pre-auth draft state locally.
- Applicant RLS remains `auth.uid()` ownership checks; no schema migration required.
- Hosted Supabase must enable Confirm email, use a Confirm signup template with
  `{{ .ConfirmationURL }}`, and configure custom SMTP for reliable delivery.
- Accounts created under the OTP flow may not have passwords; those users need new
  accounts or a future password-reset flow.
