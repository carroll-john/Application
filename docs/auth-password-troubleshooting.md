# Applicant email + password troubleshooting

## Quick checks

| Symptom | Environment | Likely cause |
| --- | --- | --- |
| Sign-in says email not confirmed | Either | User has not clicked the confirmation link yet |
| No confirmation email arrives | Hosted | Built-in Supabase mail quota or missing custom SMTP |
| OTP / confirmation emails stop after a few tries | Hosted | Supabase built-in sender (`noreply@mail.app.supabase.io`) hit `over_email_send_rate_limit` — configure Resend SMTP |
| Confirmation link opens but user is not signed in | Either | Redirect URL not allow-listed, or project paused |
| Invalid credentials on sign-in | Either | Wrong password, or account was created under the old OTP flow without a password |
| Create account succeeds but sign-in still fails | Hosted | Confirm email is disabled in Supabase dashboard |

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

## Existing OTP-only accounts

Accounts created under the previous OTP flow may exist in `auth.users` without passwords. Those users cannot sign in with email + password until they create a new account or a password reset flow is added.

## Related docs

- [memory-auth.md](memory-auth.md)
- [backend-rollout.md](backend-rollout.md)
