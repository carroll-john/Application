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

## Automated tests

```bash
npm run lint && npm test && npm run build
```
