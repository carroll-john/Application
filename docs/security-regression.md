# Security regression checklist

Manual checks after storage/auth hardening changes. Run against local Supabase (`supabase start` + `supabase db reset`).

## PostHog auth URL leakage

1. Open `/auth/callback?redirect=%2F#access_token=fake-token&refresh_token=fake-refresh` in dev with PostHog enabled.
2. Confirm no `$pageview` event is sent (network tab or PostHog live events).
3. Open `/courses/MBA` and confirm `$current_url` in `$pageview` has no hash and no `access_token` query params.

## Direct storage quota bypass

As an authenticated test user with a valid application id:

1. Upload files via the app UI until near the per-application limit — confirm the last allowed upload succeeds.
2. Use Supabase client `storage.from('application-documents').upload(...)` on the same `{userId}/{applicationId}/...` path — confirm excess uploads raise `UPLOAD_APP_FILE_COUNT_LIMIT` or `UPLOAD_RATE_LIMIT`.

## Phantom document submission

1. Set `cv_file_name` on an application without `cv_document_id` / storage object (SQL or API).
2. Call `submit_application` RPC — confirm submission fails with CV / document missing-field errors.
3. Insert `application_documents` without a matching `storage.objects` row — confirm insert fails with `DOCUMENT_STORAGE_OBJECT_MISSING`.

## Conditional submission requirements

The submit RPC enforces two conditional requirements (see
[applications.md](domains/applications.md)). After any change to
`application_submission_missing_fields`:

1. **Certificate of Completion** — a `completed` tertiary qualification with a ready
   transcript but no certificate and `transcript_confirms_completion = false` must
   report the certificate missing; flip `transcript_confirms_completion = true` and
   confirm it no longer does.
2. **English proficiency** — an application with `requires_english_proficiency = true`,
   an overseas (non-English-medium) tertiary, no `language_tests`, and no AHPRA
   `professional_accreditations` must report English proof missing. Adding an English
   test, an English-medium-country qualification, **or** a `professional_accreditations`
   row whose `name` matches the AHPRA pattern (e.g. "Registered Nurse") must clear it.
3. **Editing the function:** rebuild it from the *current* live definition
   (`pg_get_functiondef('public.application_submission_missing_fields(uuid)'::regprocedure)`
   or the latest migration that touched it), never from `0002`. The `0002` body still
   calls the dropped `is_allowed_company_user()` and uses raw document-id checks; reusing
   it reintroduces a missing-function error on every submit and bypasses
   `application_document_is_ready()`. End-to-end check: the `overseas-english` (language
   test) and `ahpra-nurse` (AHPRA registration) bot personas must both reach `/submitted`.

## Submitted-record immutability

As an authenticated applicant with one draft and one submitted application:

1. Confirm draft application autosave, child-row writes, document upload,
   replacement, and deletion still succeed.
2. Attempt direct `applications` updates that set `status`, `submitted_at`, or
   `application_number`; confirm they are rejected and
   `generate_application_number()` cannot be executed.
3. Submit through `submit_application`; confirm it assigns all three server-owned
   fields and a repeated call returns the same result.
4. Attempt to update/delete the submitted application, mutate each child table,
   delete `application_documents`, and delete its `storage.objects` row; confirm
   all applicant operations are rejected while reads still succeed.
5. Set draft policy JSON to weaker values through a direct request; confirm the
   application trigger restores the snapshot for its `(catalog_id, course_code)`
   and submission still enforces the trusted policy.

## Enrolled MFA enforcement

With one applicant who has no verified factor and one who has enrolled TOTP:

1. Confirm the no-factor applicant can sign in with a password and access owned
   applicant rows and document objects at AAL1.
2. Sign in to the enrolled account with only the password. Confirm the shared
   authenticator-code screen appears before the intended route or modal action
   resumes and no application hydration begins.
3. Using that AAL1 token directly, confirm applicant-table and Storage reads and
   writes return no rows or RLS errors, and `submit_application` raises
   `MFA_CHALLENGE_REQUIRED`.
4. Enter a valid TOTP code. Confirm the session becomes AAL2, the intended route
   resumes, and the same database, Storage, and submission operations proceed.
5. Remove the verified factor and refresh the session. Confirm ordinary AAL1
   access returns; MFA enrollment remains opt-in rather than mandatory.

## Profile password change verification

Against a project with **Require current password when updating** enabled:

1. Sign in normally, open `/profile`, and confirm the password section asks for
   the current password plus the new-password pair.
2. Enter an incorrect current password and confirm the update is rejected with
   `Current password is incorrect.`
3. Enter the correct current password and a valid new password; confirm the
   update succeeds and all three password fields clear.
4. Call Supabase `updateUser` directly with only a new password from the same
   ordinary session and confirm Auth rejects it with
   `current_password_required`.
5. Follow a valid password-reset link and confirm the recovery-token flow can
   still set a new password without asking for the old password.

## Transcript evaluation access and cost boundary

Against a deployed or preview environment with transcript evaluation enabled:

1. POST to `/api/evaluate-transcript-eligibility` without `Authorization` for
   both the ordinary and `flow=uc-credit-assessment` variants. Confirm each
   returns 401 before any eligibility-service/OpenAI request begins.
2. Repeat with an invalid bearer token and confirm the multipart transcript is
   not processed.
3. Sign in normally and confirm ordinary Section 2 transcript drafting and the
   UC comparison both send the session and still complete.
4. Send more than 10 authenticated requests in one minute from one user/IP.
   Confirm subsequent requests return 429 `ELIGIBILITY_RATE_LIMITED` before the
   file is parsed.
5. Remove the deployed Supabase Auth configuration in an isolated preview and
   confirm the route fails closed with 503 rather than entering local open mode.

## Automated tests

```bash
npm run lint && npm test && npm run build
npm test -- api/_eligibility/transcriptEligibilityAccess.test.ts \
  api/evaluate-transcript-eligibility.test.ts \
  src/lib/eligibility/client.test.ts
docker exec -i supabase_db_Applications psql -v ON_ERROR_STOP=1 \
  -U postgres -d postgres < supabase/tests/enrolled_mfa_aal2.sql
```
