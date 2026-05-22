# Memory: Auth

## Model

- Public applicant auth via Supabase email OTP (`signInWithOtp` / `verifyOtp`).
- Same flow for sign-in and sign-up. No company-domain gate. `VITE_ALLOWED_EMAIL_DOMAINS` is obsolete.
- Configured by `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Local dev: `supabase start` + Mailpit at http://127.0.0.1:54324 (codes do not go to real inboxes).
- Troubleshooting: [auth-otp-troubleshooting.md](auth-otp-troubleshooting.md)

## Entry Points

- Header sign-in
- Eligibility completion (before showing result)
- Apply actions on course pages
- `/sign-in?redirect=…` for protected routes

## Redirect Contract

- Capture redirect intent from current route or `?redirect=` on `/sign-in`.
- Post-sign-in redirects use in-app navigation after OTP verification (`verifyOtp` with `type: "email"`).
- Post-sign-in redirects must pass `sanitizeRedirectPath` (internal absolute paths only).
- Do not pass `emailRedirectTo` to `signInWithOtp`; that switches auth emails to magic-link mode.
- `/auth/callback` remains as a fallback for older magic-link emails only.
- PostHog must not capture pageviews on `/auth/callback`; `$current_url` elsewhere is sanitized (no hash, no auth query params). See [analytics-events.md](analytics-events.md).

## Key Files

| File | Role |
|------|------|
| `src/context/AuthContext.tsx` | Session, `storageMode`, OTP send/verify |
| `src/lib/authOtp.ts` | OTP request/verify helpers |
| `src/lib/authCallback.ts` | Redirect resolution, callback URL builder |
| `src/components/AuthPanel.tsx` | Shared sign-in UI |
| `src/pages/SignIn.tsx` | Route-level sign-in |
| `src/pages/AuthCallback.tsx` | Magic-link callback handler |

## Supabase Dashboard

- Magic Link email template must use `{{ .Token }}` only — do not include `{{ .ConfirmationURL }}` or users receive a link instead of a code-first email.
- Configure **custom SMTP** for hosted auth email; built-in Supabase mail is capped at a few OTP emails per hour.
- Site URL: `https://application-prototype.vercel.app`
- Redirect URLs: production `/**`, localhost `http://localhost:5173/**`

## Storage Mode

- `AuthContext.storageMode`: `remote` when session exists, `local` when signed out.
- Signed-in users use Supabase-backed profile/application/document storage.
- Offer one-time local draft import when a signed-in user has anonymous local drafts.

## Profile

- `/profile` is profile management only (email, first name, last name) — not an auth step.
- Profile seeds new applications; must not overwrite existing application values after creation.
