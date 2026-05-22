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

## Automated tests

```bash
npm run lint && npm test && npm run build
```
