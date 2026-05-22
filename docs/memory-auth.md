# Memory: Auth

## Model

- Public applicant auth via Supabase email + password (`signInWithPassword` / `signUp`).
- Same panel supports sign-in and create-account tabs. No company-domain gate. `VITE_ALLOWED_EMAIL_DOMAINS` is obsolete.
- New accounts require email confirmation before first sign-in.
- Forgot password sends a reset link; user sets a new password on `/sign-in` while `isPasswordRecovery` is true.
- Logged-in users change password on `/profile` via `ProfilePasswordSection`.
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
- Password reset passes `redirectTo` to `/sign-in?recovery=1&redirect=…` so users return after choosing a new password.
- Post-sign-in redirects use in-app navigation after `signInWithPassword` succeeds, after the confirmation link establishes a session on `/auth/callback`, or after password recovery completes.
- Post-sign-in redirects must pass `sanitizeRedirectPath` (internal absolute paths only).
- PostHog must not capture pageviews on `/auth/callback`; `$current_url` elsewhere is sanitized (no hash, no auth query params). See [analytics-events.md](analytics-events.md).

## Password Recovery

- `AuthContext.isPasswordRecovery` is the **only** flag pages should read for recovery mode.
- Token detection lives in `authCallback.ts` (`hasPasswordRecoveryTokenInUrl`); `AuthContext` initializes and updates state from URL tokens and the `PASSWORD_RECOVERY` auth event.
- Reset emails land on `/sign-in?recovery=1&redirect=…`. The `recovery=1` query flag is a landing marker only — not active recovery state. After a successful password update, `clearPasswordRecoveryQueryFromUrl()` strips `recovery=1` while preserving `redirect`.
- Protected routes redirect recovery sessions to `/sign-in?recovery=1` via `AuthRequiredLayout` in `routes.tsx`.
- Do **not** re-check recovery tokens in page components — use `isPasswordRecovery` from context only.

## AuthPanel Screens

`AuthPanel` is a thin router over named screens (`AuthScreen` in `features/auth/types.ts`):

| Screen | File | Edit when changing… |
| --- | --- | --- |
| `sign-in` | `features/auth/screens/SignInForm.tsx` | Sign-in form, forgot-password link |
| `sign-up` | `features/auth/screens/SignUpForm.tsx` | Create-account form |
| `forgot-password` | `features/auth/screens/ForgotPasswordForm.tsx` | Reset request form |
| `confirm-email-sent` | `features/auth/screens/ConfirmEmailSent.tsx` | Post sign-up “check your email” copy |
| `reset-email-sent` | `features/auth/screens/ResetEmailSent.tsx` | Post reset-request “check your email” copy |
| `new-password` | `features/auth/screens/SetNewPasswordForm.tsx` | Choose-new-password after reset link |

Shared field UI: `features/auth/components/AuthEmailField.tsx`, `AuthPasswordPair.tsx`.

## Key Files

| File | Role |
|------|------|
| `src/context/AuthContext.tsx` | Session, `storageMode`, `isPasswordRecovery`, auth actions |
| `src/lib/authPassword.ts` | Supabase calls, validation helpers, error mapping |
| `src/lib/authCallback.ts` | Redirect sanitization, callback/reset URL builders, recovery token detection |
| `src/features/auth/AuthPanel.tsx` | Thin screen router (~80 lines) |
| `src/features/auth/AuthModal.tsx` | Modal wrapper reusing `AuthPanel` |
| `src/features/profile/ProfilePasswordSection.tsx` | Logged-in password change |
| `src/pages/SignIn.tsx` | Full-page sign-in route |
| `src/pages/AuthCallback.tsx` | Email confirmation callback handler |

## Do Not Edit Casually

- `sanitizeRedirectPath` and redirect builders in `authCallback.ts` — security-sensitive.
- `AuthContext` session listener (`getSession` + `onAuthStateChange`) — single session owner.
- Supabase RLS migrations — coordinate with backend rollout.

## Required Tests After Auth Changes

```bash
npm test -- src/lib/authPassword.test.ts src/lib/authCallback.test.ts
```

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

- `/profile` is profile management (email, first name, last name, password) — password change is not an auth gate step.
- Profile seeds new applications; must not overwrite existing application values after creation.

## OTP Migration

- Accounts from the old email-code flow may lack passwords. Sign-in error copy directs users to **Forgot password** to set one.
