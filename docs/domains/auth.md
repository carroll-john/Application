---
schema_version: 1
document_type: domain_contract
domain: auth
status: active
owner: src/context/AuthContext.tsx
---

# Auth Domain

## Owner

`src/context/AuthContext.tsx` owns the browser session, authentication actions,
and password-recovery state. Shared route gates own access enforcement.

## Current contract

- Public applicant auth via Supabase email + password (`signInWithPassword` / `signUp`).
- Same panel supports sign-in and create-account tabs. No company-domain gate. `VITE_ALLOWED_EMAIL_DOMAINS` is obsolete.
- New accounts require email confirmation before first sign-in.
- Forgot password sends a reset link; user sets a new password on `/sign-in` while `isPasswordRecovery` is true.
- Logged-in users change password on `/profile` via `ProfilePasswordSection`.
- New passwords (sign-up, reset, profile change) are checked against the Pwned
  Passwords data set via `isPasswordLeaked` (`src/lib/leakedPassword.ts`) →
  `api/check-leaked-password.ts`. App-level, free-tier equivalent of Supabase's
  Pro-only leaked-password protection (DIS-119). k-anonymity: only the 5-char
  SHA-1 prefix leaves the browser. **Fails open** — never blocks on error.
- Logged-in users can enable TOTP two-factor auth on `/profile` via
  `ProfileMfaSection` (`src/lib/authMfa.ts`) (DIS-123). Requires the TOTP factor
  enabled on the Supabase project; the section self-describes when it isn't.
- Configured by `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Local dev: `supabase start` + Mailpit at http://127.0.0.1:54324 (confirmation emails do not go to real inboxes).
- Applications and applicant data require authentication. Signed-out visitors
  may browse but cannot own drafts or applicant documents.
- The UC pre-application demo is a narrow exception: a signed-out visitor may
  parse one CV into temporary in-memory course-matching state. The assessment is
  IP-rate-limited and is not persisted. Authentication is required when the
  visitor selects Start application, before the CV or extracted data can enter an
  application draft.
- After three UC courses are shortlisted, authentication is required before the
  credit-assessment transcript upload is shown. The marked transcript endpoint
  independently verifies the bearer session before reading the file. The
  transcript and comparison remain in memory and do not create a hidden draft.
- Once an authenticated applicant explicitly starts an application, extracted
  study fields from that comparison may enter the normal application state to
  prefill blank qualification data. The original file is then attached to the
  matching qualification through the shared authenticated document path.
- Troubleshooting: [auth-password.md](../runbooks/auth-password.md)

## Approved entry points

- Header sign-in
- Eligibility completion (before showing result)
- Apply actions on course pages
- Start application from the UC pre-application assessment
- Complete credit assessment from a three-course UC shortlist
- `/sign-in?redirect=…` for protected routes

## Redirect Contract

- Capture redirect intent from current route or `?redirect=` on `/sign-in`.
- Sign-up passes `emailRedirectTo` to `/auth/callback?redirect=…` so confirmed users return to the intended in-app path.
- Password reset passes `redirectTo` to `/sign-in?recovery=1&redirect=…` so users return after choosing a new password.
- Post-sign-in redirects use in-app navigation after `signInWithPassword` succeeds, after the confirmation link establishes a session on `/auth/callback`, or after password recovery completes.
- Post-sign-in redirects must pass `sanitizeRedirectPath` (internal absolute paths only).
- PostHog must not capture pageviews on `/auth/callback`; `$current_url` elsewhere is sanitized (no hash, no auth query params). See [analytics-events.md](../analytics-events.md).

## Password Recovery

- `AuthContext.isPasswordRecovery` is the **only** flag pages should read for recovery mode.
- Token detection lives in `authCallback.ts` (`hasPasswordRecoveryTokenInUrl`, including pending `token_hash`); `AuthContext` initializes and updates state from URL tokens and the `PASSWORD_RECOVERY` auth event.
- Pending `token_hash` links show the new-password form immediately; `verifyOtp` runs on form submit (not on page load) so corporate email scanners that execute JS do not consume the token.
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
| `src/context/AuthContext.tsx` | Session, `isPasswordRecovery`, auth actions |
| `src/lib/authPassword.ts` | Supabase calls, validation helpers, error mapping |
| `src/lib/authCallback.ts` | Redirect sanitization, callback/reset URL builders, recovery token detection |
| `src/features/auth/AuthPanel.tsx` | Thin screen router (~80 lines) |
| `src/features/auth/AuthModal.tsx` | Modal wrapper reusing `AuthPanel` |
| `src/features/profile/ProfilePasswordSection.tsx` | Logged-in password change |
| `src/lib/leakedPassword.ts` | Pwned Passwords check (client) + `api/check-leaked-password.ts` proxy |
| `src/lib/authMfa.ts` | TOTP MFA wrappers; UI in `src/features/profile/ProfileMfaSection.tsx` |
| `src/pages/SignIn.tsx` | Full-page sign-in route |
| `src/pages/AuthCallback.tsx` | Email confirmation callback handler |

## Forbidden shortcuts

- `sanitizeRedirectPath` and redirect builders in `authCallback.ts` — security-sensitive.
- `AuthContext` session listener (`getSession` + `onAuthStateChange`) — single session owner.
- Page-local `getSession`/`onAuthStateChange` ownership or recovery-token checks.
- Anonymous application, profile, eligibility, or document persistence.
- Supabase RLS migrations without coordination through the backend runbook.

## Required checks

```bash
npm test -- src/lib/authPassword.test.ts src/lib/authCallback.test.ts \
  src/lib/leakedPassword.test.ts src/lib/authMfa.test.ts \
  api/check-leaked-password.test.ts
```

## Supabase Dashboard

- Enable **Confirm email** under Authentication → Providers → Email.
- Confirm signup email template must include `{{ .ConfirmationURL }}`.
- Configure **custom SMTP** for reliable hosted confirmation email delivery.
- Production sender (Resend): `Applications <noreply@carroll.consulting>` — see [auth-password.md](../runbooks/auth-password.md) and `npm run verify-resend`.
- Site URL: `https://application-prototype.vercel.app`
- Redirect URLs: production `/**`, localhost `http://localhost:5173/**`
- Enable **leaked password protection** and **TOTP MFA** (Pro plan) — see [backend.md](../runbooks/backend.md) "Auth security hardening (DIS-119, DIS-123)".

## Applicant data access

- `ApplicationContext` passes the current session to
  `createApplicationStorageAdapter`.
- An authenticated session produces the remote Supabase adapter; no session
  produces a no-write guest adapter.
- There is no anonymous application draft or draft-import contract.
- The UC pre-application assessment is temporary browser state, not an
  application draft. Closing or refreshing the page discards it.
- The UC credit comparison is also temporary browser state. Its transcript is
  authenticated and processed ephemerally. An explicit Start application action
  may carry extracted study fields into blank authenticated qualification data and
  attach the transcript through the ordinary authenticated document system.

## Profile

- `/profile` is profile management (email, first name, last name, password) — password change is not an auth gate step.
- Profile seeds new applications; must not overwrite existing application values after creation.

## OTP Migration

- Accounts from the old email-code flow may lack passwords. Sign-in error copy directs users to **Forgot password** to set one.

## Intentional mirrors

- Supabase RLS is defense-in-depth for authenticated routes; it does not replace
  shared browser route gates.
- Password policy is shown in UI and enforced by auth actions. Shared helpers and
  auth tests protect the mirror.

## Related decisions

- [ADR-0001: Authenticated Applicant Data](../decisions/0001-authenticated-applicant-data.md)
- [ADR-0006: Repository Context Control Plane](../decisions/0006-context-control-plane.md)
