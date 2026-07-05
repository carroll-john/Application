# Applicant email + password troubleshooting

## Quick checks

| Symptom | Environment | Likely cause |
| --- | --- | --- |
| Sign-in says email not confirmed | Either | User has not clicked the confirmation link yet |
| No confirmation email arrives | Hosted | Built-in Supabase mail quota or missing custom SMTP |
| Confirmation or reset emails stop after a few tries | Hosted | Supabase built-in sender (`noreply@mail.app.supabase.io`) hit `over_email_send_rate_limit` — configure Resend SMTP |
| Confirmation link opens but user is not signed in | Either | Redirect URL not allow-listed, or project paused |
| Reset link shows expired immediately (corporate email) | Hosted | Microsoft Safe Links / email scanners prefetch `{{ .ConfirmationURL }}` and consume the one-time token before the user clicks — see [Password reset and email prefetch](#password-reset-and-email-prefetch) |
| Invalid credentials on sign-in | Either | Wrong password, or the account was created under the old email-code flow and never got a password you chose |
| Create account says confirmation sent but no email arrives | **Production** | Email already registered — Supabase returns success without resending (anti-enumeration). Use **Sign in** instead. |
| Old email-code account cannot sign in | **Production** | Use **Forgot password** on the Sign in tab to set a password for the existing account. |

## Local development

1. Run `supabase start`
2. Open Mailpit at http://127.0.0.1:54324
3. Create an account in the app
4. Open the confirmation email in Mailpit and click the link
5. Return to the app and sign in with the same email and password

Local config enables confirmations in [`supabase/config.toml`](../supabase/config.toml) and uses [`supabase/templates/confirm_signup.html`](../supabase/templates/confirm_signup.html).

## Hosted Supabase checklist

Project ref: `weyxnhykyyetquqprfnu`

1. Restore the project if it is paused: [General settings](https://supabase.com/dashboard/project/weyxnhykyyetquqprfnu/settings/general)
2. Enable **Confirm email** under [Authentication → Providers → Email](https://supabase.com/dashboard/project/weyxnhykyyetquqprfnu/auth/providers)
3. Confirm [URL configuration](https://supabase.com/dashboard/project/weyxnhykyyetquqprfnu/auth/url-configuration):
   - Site URL: `https://application-prototype.vercel.app`
   - Redirect URLs include production `/**` and local dev URLs
4. Update [Confirm signup template](https://supabase.com/dashboard/project/weyxnhykyyetquqprfnu/auth/templates) to include a confirmation link:
   ```text
   Follow this link to confirm your email: {{ .ConfirmationURL }}
   ```
5. Configure [custom SMTP](https://supabase.com/dashboard/project/weyxnhykyyetquqprfnu/auth/smtp) so confirmation emails are reliable in production

### Resend SMTP example

Production sender (verified domain `carroll.consulting` in Resend):

`Applications <noreply@carroll.consulting>`

| Field | Value |
| --- | --- |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | Your Resend API key |
| Sender email | `noreply@carroll.consulting` |

After saving SMTP settings, create a test account and confirm delivery in Resend logs before testing production sign-in.

### Supabase SMTP — paste these values

Open [Authentication → SMTP](https://supabase.com/dashboard/project/weyxnhykyyetquqprfnu/auth/smtp), enable custom SMTP, and save:

| Field | Value |
| --- | --- |
| Host | `smtp.resend.com` |
| Port number | `465` |
| Username | `resend` |
| Password | Your Resend API key (`re_...`) |
| Sender email | `noreply@carroll.consulting` |
| Sender name | `Applications` (optional) |

After saving, hosted auth emails should leave `noreply@carroll.consulting` via Resend instead of `noreply@mail.app.supabase.io`.

### Resend plugin / CLI verification

1. Connect the Cursor **Resend** plugin: **Settings → Plugins → Resend → Environment variables → `RESEND_API_KEY`** (paste your `re_...` token from [resend.com/api-keys](https://resend.com/api-keys)). Do **not** edit the plugin cache file under `~/.cursor/plugins/cache/.../.mcp.json` — that template is overwritten on plugin update.
2. From the repo root, run:

   ```bash
   RESEND_API_KEY=re_... npm run verify-resend
   RESEND_API_KEY=re_... npm run verify-resend -- --smoke-test john.carroll@keypathedu.com.au
   ```

   This lists or verifies `carroll.consulting`, prints DNS records if needed, and optionally sends a smoke-test email. Use Resend MCP `list-domains`, `list-emails`, and `list-logs` to confirm delivery after Supabase SMTP is saved.

Hosted Supabase auth logs (2026-05-22) showed confirmation mail still sent from `noreply@mail.app.supabase.io` with `over_email_send_rate_limit` — custom Resend SMTP removes that quota ceiling.

## Password reset and email prefetch

Corporate email (especially Microsoft 365 / Defender **Safe Links**) prefetches links in incoming mail. Supabase reset emails that use `{{ .ConfirmationURL }}` point at `https://<project>.supabase.co/auth/v1/verify?token=…`, which is consumed on the prefetch **GET** — so the user sees `otp_expired` / “This reset link has expired” on first click.

**Evidence (2026-07-05, `john.carroll@keypathedu.com.au`):** Supabase auth logs show `/recover` from the user IP, then `/verify` **login success** ~20s later from Azure IPs (`48.215.x`, `68.218.x`, `4.199.x`), then `/verify` **One-time token not found** from the user IP.

### App fix (token_hash + verifyOtp)

The repo recovery template [`supabase/templates/recovery.html`](../supabase/templates/recovery.html) now links to the app callback instead of `{{ .ConfirmationURL }}`:

```html
<a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery">Reset password</a>
```

`resetPasswordForEmail` passes `redirectTo` as `/auth/callback?redirect=…`. The app calls `verifyOtp({ token_hash, type: 'recovery' })` in [`AuthCallback.tsx`](../src/pages/AuthCallback.tsx) — a **POST**, so Safe Links prefetch of the landing page does not consume the token.

**Hosted dashboard — required after deploy:**

1. Open [Authentication → Email Templates → Reset password](https://supabase.com/dashboard/project/weyxnhykyyetquqprfnu/auth/templates).
2. Replace the reset link with the same pattern as the repo template above (use `{{ .RedirectTo }}`, `{{ .TokenHash }}`, `type=recovery`).
3. Ensure [Redirect URLs](https://supabase.com/dashboard/project/weyxnhykyyetquqprfnu/auth/url-configuration) still include `https://application-prototype.vercel.app/**`.

Until the hosted template is updated, newly requested reset emails still use the old `ConfirmationURL` behaviour.

### Workarounds for users on old links

- Request a fresh reset and click immediately.
- Use a personal email inbox without link scanning.
- Ask IT to allowlist `application-prototype.vercel.app` and `*.supabase.co` from Safe Links URL scanning.

## Existing OTP-only accounts

Accounts created under the previous email-code flow may exist in `auth.users` without passwords. Those users should open **Sign in → Forgot password** to set a password for the existing account.

## Related docs

- [memory-auth.md](memory-auth.md)
- [backend-rollout.md](backend-rollout.md)
