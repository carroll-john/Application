# Applicant email + password troubleshooting

## Quick checks

| Symptom | Environment | Likely cause |
| --- | --- | --- |
| Sign-in says email not confirmed | Either | User has not clicked the confirmation link yet |
| No confirmation email arrives | Hosted | Built-in Supabase mail quota or missing custom SMTP |
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

| Field | Value |
| --- | --- |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | Your Resend API key |
| Sender email | An address on a domain verified in Resend |

After saving SMTP settings, create a test account and confirm delivery in Mailpit or the provider logs before testing production sign-in.

## Existing OTP-only accounts

Accounts created under the previous OTP flow may exist in `auth.users` without passwords. Those users cannot sign in with email + password until they create a new account or a password reset flow is added.

## Related docs

- [memory-auth.md](memory-auth.md)
- [backend-rollout.md](backend-rollout.md)
