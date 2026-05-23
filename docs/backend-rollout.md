# Backend Rollout

## Target Stack
- Hosting: Vercel
- Auth: Supabase Auth
- Database: Supabase Postgres
- File storage: Supabase Storage

## Access Model
- Current access model: public applicant auth through Supabase email + password.
- `/sign-in` exposes Sign in and Create account tabs. New accounts must confirm email before first sign-in.
- No company-domain allowlist is used in the frontend, RLS policies, storage policies, or submit RPC.
- Signed-in users use Supabase-backed profile, application, and document storage. Anonymous users can browse courses and keep pre-auth local drafts.
- RLS protects applicant data with `auth.uid()` ownership checks.

## Environment Variables
Add these to Vercel and local `.env`:

```env
VITE_ANALYTICS_HASH_SALT=replace_with_private_salt
VITE_CLARITY_PROJECT_ID=your_clarity_project_id
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
VITE_POSTHOG_KEY=your_posthog_project_key
VITE_POSTHOG_HOST=https://us.i.posthog.com
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_REMOTE_UPLOAD_MAX_FILES_PER_APPLICATION=30
VITE_REMOTE_UPLOAD_MAX_TOTAL_BYTES_PER_APPLICATION=104857600
VITE_REMOTE_UPLOAD_RATE_LIMIT_WINDOW_MINUTES=10
VITE_REMOTE_UPLOAD_RATE_LIMIT_MAX_UPLOADS=20
SENTRY_ENABLED=true
SENTRY_DSN=your_sentry_dsn
SENTRY_ENVIRONMENT=preview
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_AGENT_NAME=cv-parser-employment-agent
SENTRY_AI_RECORD_INPUTS=false
SENTRY_AI_RECORD_OUTPUTS=false
VITE_SENTRY_ENABLED=true
VITE_SENTRY_DSN=your_sentry_dsn
VITE_SENTRY_ENVIRONMENT=preview
VITE_SENTRY_TRACES_SAMPLE_RATE=0.1
VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE=0
VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE=0.1
SENTRY_AUTH_TOKEN=your_sentry_auth_token
SENTRY_ORG=your_sentry_org_slug
SENTRY_PROJECT=your_sentry_project_slug
```

Current workspace values:
- `VITE_SUPABASE_URL` points at your Supabase project
- `VITE_CLARITY_PROJECT_ID` is optional; the frontend loader is a no-op until it is set
- remote upload guardrail defaults are:
  - `VITE_REMOTE_UPLOAD_MAX_FILES_PER_APPLICATION=30`
  - `VITE_REMOTE_UPLOAD_MAX_TOTAL_BYTES_PER_APPLICATION=104857600` (100 MB)
  - `VITE_REMOTE_UPLOAD_RATE_LIMIT_WINDOW_MINUTES=10`
  - `VITE_REMOTE_UPLOAD_RATE_LIMIT_MAX_UPLOADS=20`
- server-side Sentry capture for `/api/parse-cv` uses `SENTRY_DSN` (or falls back to `VITE_SENTRY_DSN` if omitted)
- server-side document delivery proxy (`/api/document-delivery`) reads `SUPABASE_URL`/`SUPABASE_ANON_KEY` when present, and falls back to `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`
- server-side parser tracing uses `SENTRY_TRACES_SAMPLE_RATE` and emits Agent Insights spans (`gen_ai.invoke_agent` and `gen_ai.response`)
- keep `SENTRY_AI_RECORD_INPUTS` and `SENTRY_AI_RECORD_OUTPUTS` disabled unless you intentionally want prompt/response content captured
- frontend Sentry capture uses `VITE_SENTRY_DSN` and `VITE_SENTRY_ENABLED`
- frontend smoke-test markers are filtered before send in non-development environments (`/dev/sentry-smoke`, `dev_sentry_smoke`, and codex smoke messages)
- source map upload during build requires `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT`
- PostHog runs with manual event capture only (`autocapture: false`) and uses hashed analytics user IDs.
- Clarity excludes likely automated traffic (for example `navigator.webdriver`, headless/bot user agents), supports explicit opt-out via `?clarity=off` or local/session storage key `application-prototype:disable-clarity=1`, and is masked/disabled on PII-heavy application routes.
- keep the publishable key only in local env and Vercel envs, not in checked-in docs

## Restore a paused or inactive hosted project
Free-tier Supabase projects auto-pause after inactivity. While paused, the project API hostname does not resolve (`NXDOMAIN` / `Failed to fetch`), so hosted auth and `supabase db push` both fail until the project is restored.

1. Open the [Supabase dashboard projects list](https://supabase.com/dashboard/projects) and select **Application** (`weyxnhykyyetquqprfnu`, ap-south-1).
2. If the project shows **Paused** or **Inactive**, use **Restore project** on [General settings](https://supabase.com/dashboard/project/weyxnhykyyetquqprfnu/settings/general). Wait for the restore email; DNS for `https://weyxnhykyyetquqprfnu.supabase.co` should resolve again.
3. Confirm CLI status: `supabase projects list -o json` should show `ACTIVE_HEALTHY` (not `INACTIVE`).
4. Re-run the post-restore checklist below (auth URLs, email template, Vercel env vars, migration verification).

Projects paused longer than 90 days may lose one-click restore. Download backups from the project overview and follow [Supabase restore guidance](https://supabase.com/docs/guides/platform/upgrading#pause-and-restore) or create a new project and re-apply migrations from `supabase/migrations/`.

## Supabase Project Setup
Run [supabase/migrations/0001_initial.sql](/Users/jc/Documents/Applications/supabase/migrations/0001_initial.sql) in the Supabase SQL editor.

Then run [supabase/migrations/0002_server_submit.sql](/Users/jc/Documents/Applications/supabase/migrations/0002_server_submit.sql) to add:
- server-side submission validation
- server-side application number generation
- the `submit_application` RPC used by the review screen

Then run [supabase/migrations/0003_business_users_and_applicant_profiles.sql](/Users/jc/Documents/Applications/supabase/migrations/0003_business_users_and_applicant_profiles.sql) to add:
- `business_users`
- `applicant_profiles`
- `applications.applicant_profile_id`
- the RLS foundation for separating internal site users from applicant records

Then run [supabase/migrations/0004_submission_rpc_grants.sql](/Users/jc/Documents/Applications/supabase/migrations/0004_submission_rpc_grants.sql) to add:
- authenticated execute grants for `submit_application` and supporting RPC functions
- authenticated sequence permissions for server-generated application numbers

Then run [supabase/migrations/0005_document_upload_limits.sql](/Users/jc/Documents/Applications/supabase/migrations/0005_document_upload_limits.sql) to add:
- explicit application-document upload quotas and rate limits
- indexes for user/rate-limit document checks

Then run the applicant auth migration to remove the old company-domain RLS dependency:
- use the latest `*_applicant_email_otp_auth.sql` migration (filename is historical; policy changes are auth-method agnostic)
- set the local and deployed site URLs in Supabase Auth
- enable email confirmation and configure the Confirm signup template with `{{ .ConfirmationURL }}`

### Applicant password auth troubleshooting

See [auth-password-troubleshooting.md](./auth-password-troubleshooting.md).

- **Local:** `supabase start`, then read confirmation emails in Mailpit at `http://127.0.0.1:54324` (not a real inbox). Run `npm run sync-supabase-env` to refresh `.env.local`.
- **Hosted:** if the linked project ref `weyxnhykyyetquqprfnu` is `INACTIVE`, restore it in the Supabase dashboard before auth or API calls will work. There is no CLI restore command.
- **Vercel:** after restore, confirm `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` match the live project and redeploy.

Important:
- database and storage access are enforced by owner-scoped RLS using `auth.uid()`
- the app is now live at `https://application-prototype.vercel.app`
- the current production deployment includes the server-backed submit flow from `0002_server_submit.sql`

## Schema Shape
Primary database objects are defined in:
- `supabase/migrations/0001_initial.sql`

Key tables:
- `business_users`
- `applicant_profiles`
- `applications`
- `application_documents`
- `tertiary_qualifications`
- `employment_experiences`
- `professional_accreditations`
- `secondary_qualifications`
- `language_tests`

Notes:
- `applications.user_id` is the signed-in applicant user.
- `applications.applicant_profile_id` points to the reusable applicant profile record.
- section 1 single-instance data stays on `applications` as JSONB for now:
  - `personal_details`
  - `contact_details`
- repeated section 2 records are normalized into their own tables
- uploaded files are stored in the private `application-documents` bucket and referenced from `application_documents`
- The Tuesday-demo product model is:
  - one reusable profile per signed-in user
  - multiple applications per user
  - one open draft per course
  - submitted applications kept as separate historical records

## Storage Convention
- Bucket: `application-documents`
- Recommended path format:
  - `{auth.uid()}/{application_id}/{kind}/{document_id}-{file_name}`
- This aligns with the storage policy in the migration, which expects the first folder segment to be the current user's auth ID.

## Rollout Order
1. Create the Supabase project.
2. Run `supabase/migrations/0001_initial.sql`.
3. Run `supabase/migrations/0002_server_submit.sql`.
4. Run `supabase/migrations/0003_business_users_and_applicant_profiles.sql`.
5. Run `supabase/migrations/0004_submission_rpc_grants.sql`.
6. Run `supabase/migrations/0005_document_upload_limits.sql`.
7. Run the latest `*_applicant_email_otp_auth.sql` migration.
8. Configure Supabase Auth email confirmation, Confirm signup template, site URL, and redirect URLs.
9. Configure the Vercel env vars.

## Current Frontend State
- The app now has:
  - Supabase client scaffolding
  - auth provider
  - sign-in page
  - callback route
  - protected routing
- The app now uses public applicant email + password auth:
  - users browse courses publicly
  - header, eligibility, and apply entry points can initiate auth
  - new users confirm email via link, then sign in with password
  - signed-in profile and draft storage use Supabase
- `/profile` is now a plain reusable profile-management screen, not an auth step.
- Course selection is catalog-driven and attached to each application through `applicationMeta.selectedCourse`.
- The app now supports multiple applications per user and resumes an existing open draft for the same course instead of creating duplicates.
- Current application state is remote for signed-in users and local for anonymous pre-auth drafts.
- Document uploads are local-first:
  - `src/lib/documentStorage.ts` uses IndexedDB when no authenticated Supabase session is available
  - remote uploads remain available in code for any future return to real auth
- Explicit upload controls now exist for remote mode:
  - per-file size cap: 5 MB
  - per-application quota: max 30 files, max 100 MB total
  - per-user rate limit: max 20 uploads per 10 minutes
- Remote document delivery is now proxy-first for authenticated sessions:
  - `src/lib/documentStorage.ts` requests `/api/document-delivery` with a bearer token instead of opening raw signed URLs
  - the proxy enforces `Cache-Control: no-store` and returns `Content-Disposition: attachment` for sensitive document MIME types
  - localhost dev falls back to signed URLs only when the proxy endpoint is unavailable
- CV parsing now runs through the Vercel server function `/api/parse-cv`:
  - requires `OPENAI_API_KEY`
  - requires `SUPABASE_URL` and `SUPABASE_ANON_KEY` (or `VITE_*` fallbacks) on Vercel so deployed auth checks succeed
  - optionally uses `OPENAI_CV_PARSER_MODEL`
  - can be cohort-gated with the PostHog feature flag `cv_parser_autofill_experiment`
  - drafts employment history back into the same local application state used in Section 2
- Production CV upload checklist (after deploy):
  - confirm `20260522120000_storage_quota_and_document_integrity.sql` is applied in the Supabase SQL editor
  - upload a `.docx` from Safari/macOS (empty `file.type`) on `/section2/add-cv` — should succeed with inferred MIME
  - with empty employment history and the parser flag enabled, Save should draft roles or show a parser warning (CV still saved)
- Remaining limitation:
  - the remote storage path still needs end-to-end verification against a real Supabase project and bucket configuration
  - document cleanup is best-effort today; orphaned remote file records are still possible if a document upload succeeds but a later draft save fails
  - `supabase db push` from this workspace is currently blocked by hosted DB DNS resolution, so new SQL migrations should be run in the Supabase SQL editor

## Clean Test Reset
To reset hosted test data before a fresh run, execute:
- [supabase/reset_test_data.sql](/Users/jc/Documents/Applications/supabase/reset_test_data.sql)

This will:
- delete all application records
- clear stored document object metadata
- reset the application number sequence to `QX-1000000`

For a truly clean user test, also use a private/incognito browser session or clear site data for the deployed origin so the local browser cache does not repopulate the draft.
