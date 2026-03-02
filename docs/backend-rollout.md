# Backend Rollout

## Target Stack
- Hosting: Vercel
- Auth: Supabase Auth
- Database: Supabase Postgres
- File storage: Supabase Storage

## Access Model
- Initial access model: magic-link sign-in restricted to approved company email domains.
- Current rollout phase: keep that company-domain gate on the entire site so Keypath employees can dogfood the product safely.
- Long-term model: site access and applicant identity are separate concerns.
  - `business_users` is the internal employee using the site
  - `applicant_profiles` is the applicant record being created/tested inside the site
  - public applicant auth should come later, after the internal dogfood phase
- Current Tuesday-demo frontend model uses one real auth flow only:
  - Keypath-domain Supabase magic-link auth on `/sign-in`
  - no second inner applicant OTP/login layer
  - first successful sign-in provisions or reuses a single `applicant_profiles` record for that user
- Domains are configured in two places:
  - frontend env: `VITE_ALLOWED_EMAIL_DOMAINS`
  - database allowlist: `public.allowed_email_domains`
- Short-term gate: client-side email domain validation before sending the magic link.
- Server-side gate: row-level security depends on `public.is_allowed_company_user()`, which checks the signed-in user's email domain against the allowlist table.
- Production hardening path: move to your company IdP via Supabase SSO or an auth hook before wider rollout.

## Environment Variables
Add these to Vercel and local `.env`:

```env
VITE_CLARITY_PROJECT_ID=your_clarity_project_id
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_ALLOWED_EMAIL_DOMAINS=yourcompany.com
```

Current workspace values:
- `VITE_SUPABASE_URL` points at your Supabase project
- `VITE_ALLOWED_EMAIL_DOMAINS=keypathedu.com.au`
- `VITE_CLARITY_PROJECT_ID` is optional; the frontend loader is a no-op until it is set
- Clarity excludes likely automated traffic (for example `navigator.webdriver`, headless/bot user agents) and supports explicit opt-out via `?clarity=off` or local/session storage key `application-prototype:disable-clarity=1`.
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

Then configure Auth in Supabase:
- enable email magic links / OTP sign-in
- set the local site URL to `http://127.0.0.1:5173`
- add redirect URLs:
  - `http://127.0.0.1:5173/auth/callback`
  - `https://application-prototype.vercel.app/auth/callback`
  - any future Vercel preview URL callback
- disable any auth providers you do not want exposed initially

Important:
- the sign-in screen blocks non-company domains in the client
- the auth/session layer now also rejects authenticated sessions whose email domain is not in `VITE_ALLOWED_EMAIL_DOMAINS`
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
4. Configure Auth:
   - enable magic links
   - set the site URL and redirect URLs for local + Vercel
   - disable providers you do not want exposed
5. Configure the Vercel env vars.
6. Replace local draft persistence with backend persistence.
7. Replace IndexedDB document storage with Supabase Storage uploads.
8. Move submission validation and application-number generation to server-backed operations.

## Current Frontend State
- The app now has:
  - Supabase client scaffolding
  - auth provider
  - sign-in page
  - callback route
  - protected routing
- The app now uses one real Keypath-only auth flow:
  - users browse courses publicly
  - apply attempts route unauthenticated users to `/sign-in`
  - successful sign-in returns them to the intended course flow
  - auth provisioning creates or reuses the user's `applicant_profile`
- `/profile` is now a plain reusable profile-management screen, not an auth step.
- Course selection is catalog-driven and attached to each application through `applicationMeta.selectedCourse`.
- The app now supports multiple applications per user and resumes an existing open draft for the same course instead of creating duplicates.
- Current application state is now hybrid:
  - local cache and offline fallback in `ApplicationContext`
  - authenticated draft sync through `src/lib/applicationRemoteStore.ts`
- Document uploads are now remote-capable:
  - `src/lib/documentStorage.ts` uploads to Supabase Storage when auth + Supabase config + an application record are available
  - the Section 2 document forms create a remote application record on demand if needed before upload
  - local IndexedDB storage remains the fallback in development or when Supabase is not configured
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
