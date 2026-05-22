# Memory: Auth

## Model

- Public applicant auth via Supabase email + password (`signInWithPassword` / `signUp`).
- Same panel supports sign-in and create-account tabs. No company-domain gate. `VITE_ALLOWED_EMAIL_DOMAINS` is obsolete.
- New accounts require email confirmation before first sign-in.
- Configured by `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Local dev: `supabase start` + Mailpit at http://127.0.0.1:54324 (confirmation emails do not go to real inboxes).
- Troubleshooting: [auth-password-troubleshooting.md](auth-password-troubleshooting.md)

## Entry Points

- Header sign-in
- Eligibility completion (before showing result)
- Apply actions on course pages
- `/sign-in?redirect=…` for protected routes

## Redirect Contract

- Capture redirect intent from current route or `?redirect=` on `/sign-in`.
- Sign-up passes `emailRedirectTo` to `/auth/callback?redirect=…` so confirmed users return to the intended in-app path.
- Post-sign-in redirects use in-app navigation after `signInWithPassword` succeeds or after the confirmation link establishes a session on `/auth/callback`.
- Post-sign-in redirects must pass `sanitizeRedirectPath` (internal absolute paths only).
- PostHog must not capture pageviews on `/auth/callback`; `$current_url` elsewhere is sanitized (no hash, no auth query params). See [analytics-events.md](analytics-events.md).

## Key Files

| File | Role |
|------|------|
| `src/context/AuthContext.tsx` | Session, `storageMode`, password sign-in/sign-up |
| `src/lib/authPassword.ts` | Password auth helpers and error mapping |
| `src/lib/authCallback.ts` | Redirect resolution, callback URL builder |
| `src/features/auth/AuthPanel.tsx` | Shared sign-in / create-account UI |
| `src/pages/SignIn.tsx` | Route-level sign-in |
| `src/pages/AuthCallback.tsx` | Email confirmation callback handler |

## Supabase Dashboard

- Enable **Confirm email** under Authentication → Providers → Email.
- Confirm signup email template must include `{{ .ConfirmationURL }}`.
- Configure **custom SMTP** for reliable hosted confirmation email delivery.
- Production sender (Resend): `Applications <noreply@carroll.consulting>` — see [auth-password-troubleshooting.md](auth-password-troubleshooting.md) and `npm run verify-resend`.
- Site URL: `https://application-prototype.vercel.app`
- Redirect URLs: production `/**`, localhost `http://localhost:5173/**`

## Storage Mode

- `AuthContext.storageMode`: `remote` when session exists, `local` when signed out.
- Signed-in users use Supabase-backed profile/application/document storage.
- Offer one-time local draft import when a signed-in user has anonymous local drafts.

## Profile

- `/profile` is profile management only (email, first name, last name) — not an auth step.
- Profile seeds new applications; must not overwrite existing application values after creation.
