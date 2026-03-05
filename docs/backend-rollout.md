# Backend Rollout

## Target Stack
- Hosting: Vercel
- Auth: Supabase Auth
- Database: Supabase Postgres
- File storage: Supabase Storage

## Access Model
- Initial access model: company-email gate restricted to approved company email domains.
- Current rollout phase: keep that company-domain gate on the entire site so Keypath employees can dogfood the product safely.
- Long-term model: site access and applicant identity are separate concerns.
  - `business_users` is the internal employee using the site
  - `applicant_profiles` is the applicant record being created/tested inside the site
  - public applicant auth should come later, after the internal dogfood phase
- Current Tuesday-demo frontend model uses one lightweight access gate only:
  - Keypath-domain email validation on `/sign-in`
  - no OTP, magic-link, or second inner applicant login layer
  - profile and draft data run through the local fallback path unless a newer auth decision restores real sessions
- Domains are configured in two places:
  - frontend env: `VITE_ALLOWED_EMAIL_DOMAINS`
  - database allowlist: `public.allowed_email_domains`
- Short-term gate: client-side email domain validation before granting access to the prototype.
- Server-side gate: row-level security depends on `public.is_allowed_company_user()`, which checks the signed-in user's email domain against the allowlist table.
- Production hardening path: move to your company IdP via Supabase SSO or an auth hook before wider rollout.

## Environment Variables
Add these to Vercel and local `.env`:

```env
VITE_ANALYTICS_CONSENT_DEFAULT=denied
VITE_ANALYTICS_HASH_SALT=replace_with_private_salt
VITE_CLARITY_PROJECT_ID=your_clarity_project_id
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
VITE_POSTHOG_KEY=your_posthog_project_key
VITE_POSTHOG_HOST=https://us.i.posthog.com
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_ALLOWED_EMAIL_DOMAINS=yourcompany.com
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
- `VITE_ALLOWED_EMAIL_DOMAINS=keypathedu.com.au`
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
- Analytics tooling is consent-gated via local storage key `application-prototype:analytics-consent` (`granted` or `denied`), with `VITE_ANALYTICS_CONSENT_DEFAULT` as the fallback.
- keep the publishable key only in local env and Vercel envs, not in checked-in docs

## Supabase Project Setup
Run [supabase/migrations/0001_initial.sql](/Users/jc/Documents/New%20project/supabase/migrations/0001_initial.sql) in the Supabase SQL editor, then seed the company allowlist:

```sql
insert into public.allowed_email_domains (domain)
values ('keypathedu.com.au')
on conflict (domain) do nothing;
```

Then run [supabase/migrations/0002_server_submit.sql](/Users/jc/Documents/New%20project/supabase/migrations/0002_server_submit.sql) to add:
- server-side submission validation
- server-side application number generation
- the `submit_application` RPC used by the review screen

Then run [supabase/migrations/0003_business_users_and_applicant_profiles.sql](/Users/jc/Documents/New%20project/supabase/migrations/0003_business_users_and_applicant_profiles.sql) to add:
- `business_users`
- `applicant_profiles`
- `applications.applicant_profile_id`
- the RLS foundation for separating internal site users from applicant records

Then run [supabase/migrations/0004_submission_rpc_grants.sql](/Users/jc/Documents/New%20project/supabase/migrations/0004_submission_rpc_grants.sql) to add:
- authenticated execute grants for `submit_application` and supporting RPC functions
- authenticated sequence permissions for server-generated application numbers

Then run [supabase/migrations/0005_document_upload_limits.sql](/Users/jc/Documents/New%20project/supabase/migrations/0005_document_upload_limits.sql) to add:
- explicit application-document upload quotas and rate limits
- indexes for user/rate-limit document checks

Then configure Auth in Supabase when real auth returns:
- enable the providers you actually intend to use
- set the local site URL and redirect URLs for the chosen auth flow
- keep unused providers disabled

Important:
- the sign-in screen blocks non-company domains in the client
- the current production flow does not depend on a real Supabase session
- database and storage access are still enforced by RLS via `public.allowed_email_domains`
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
- `allowed_email_domains`

Notes:
- `applications.user_id` is still the signed-in Keypath employee during dogfooding.
- `applications.applicant_profile_id` is the bridge to the future public applicant model and the current reusable profile record.
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
3. Insert allowed domains into `public.allowed_email_domains`.
4. Run `supabase/migrations/0002_server_submit.sql`.
5. Run `supabase/migrations/0003_business_users_and_applicant_profiles.sql`.
6. Run `supabase/migrations/0004_submission_rpc_grants.sql`.
7. Run `supabase/migrations/0005_document_upload_limits.sql`.
8. Configure Auth (only if restoring real authenticated sessions):
   - enable the provider(s) you intend to use
   - set the site URL and redirect URLs for local + Vercel
   - disable providers you do not want exposed
9. Configure the Vercel env vars.
10. Replace local draft persistence with backend persistence.
11. Replace IndexedDB document storage with Supabase Storage uploads.
12. Move submission validation and application-number generation to server-backed operations.

## Current Frontend State
- The app now has:
  - Supabase client scaffolding
  - auth provider
  - sign-in page
  - callback route
  - protected routing
- The app now uses one Keypath-only email gate:
  - users browse courses publicly
  - apply attempts route unauthenticated users to `/sign-in`
  - entering an allowed company email returns them to the intended course flow
  - local profile and draft storage back the current demo flow
- `/profile` is now a plain reusable profile-management screen, not an auth step.
- Course selection is catalog-driven and attached to each application through `applicationMeta.selectedCourse`.
- The app now supports multiple applications per user and resumes an existing open draft for the same course instead of creating duplicates.
- Current application state is local-first for the demo:
  - local cache and offline fallback in `ApplicationContext`
  - authenticated draft sync remains available in code, but the current email-gate flow does not create a real session
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
  - optionally uses `OPENAI_CV_PARSER_MODEL`
  - can be cohort-gated with the PostHog feature flag `cv_parser_autofill_experiment`
  - drafts employment history back into the same local application state used in Section 2
- Remaining limitation:
  - the remote storage path still needs end-to-end verification against a real Supabase project and bucket configuration
  - document cleanup is best-effort today; orphaned remote file records are still possible if a document upload succeeds but a later draft save fails
  - `supabase db push` from this workspace is currently blocked by hosted DB DNS resolution, so new SQL migrations should be run in the Supabase SQL editor

## Clean Test Reset
To reset hosted test data before a fresh run, execute:
- [supabase/reset_test_data.sql](/Users/jc/Documents/New%20project/supabase/reset_test_data.sql)

This will:
- delete all application records
- clear stored document object metadata
- reset the application number sequence to `QX-1000000`

For a truly clean user test, also use a private/incognito browser session or clear site data for the deployed origin so the local browser cache does not repopulate the draft.
