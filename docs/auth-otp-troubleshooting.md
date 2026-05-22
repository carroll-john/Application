# Applicant email OTP troubleshooting

## Quick diagnosis

| Symptom | Likely environment | Root cause |
| --- | --- | --- |
| UI says code was sent, nothing in Gmail/Outlook | **Local** (`npm run dev`) | Local Supabase sends auth mail to **Mailpit**, not real inboxes |
| `We couldn't reach the sign-in service` on Vercel | **Production** | Hosted Supabase project is **INACTIVE** (DNS for `*.supabase.co` fails) |
| Same error on localhost | **Local** | `supabase start` is not running or `.env.local` points at a dead URL |
| Code arrives but verify fails | Either | Wrong code, expired code, or email template missing `{{ .Token }}` on hosted |

## Local development

1. Start the stack: `supabase start`
2. Sync env (optional): `npm run sync-supabase-env` — writes `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` into `.env.local`
3. Run the app: `npm run dev`
4. Request a code on `/sign-in`
5. Open **Mailpit**: [http://127.0.0.1:54324](http://127.0.0.1:54324)

The auth email subject should say "Your sign-in code". The body should contain only the 6-digit code (`{{ .Token }}`), not a magic link. Use that value in the app.

### Verify the API directly

```bash
ANON_KEY="$(grep '^VITE_SUPABASE_ANON_KEY=' .env.local | cut -d= -f2-)"
curl -sS -X POST "http://127.0.0.1:54321/auth/v1/otp" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","create_user":true}'
```

Do not pass `email_redirect_to` in this payload unless you intentionally want magic-link emails.

Then confirm a new message appears in Mailpit.

## Hosted / Vercel (`application-prototype.vercel.app`)

The linked Supabase project **Application** (`weyxnhykyyetquqprfnu`, ap-south-1) must be **ACTIVE_HEALTHY**. When it is **INACTIVE** or paused:

- `https://weyxnhykyyetquqprfnu.supabase.co` may not resolve (NXDOMAIN)
- Browser OTP requests fail with `Failed to fetch`
- The UI shows a connectivity error (mentions restoring the project)

There is **no** `supabase projects restore` CLI command. Restoration must be done in the dashboard.

### Manual steps (hosted)

1. Open [Supabase dashboard](https://supabase.com/dashboard) → organization → project **Application** (`weyxnhykyyetquqprfnu`)
2. If paused, **Restore / unpause** the project and wait until status is **ACTIVE_HEALTHY**
3. Confirm DNS: `dig +short weyxnhykyyetquqprfnu.supabase.co` returns records
4. **Authentication → URL configuration**
   - Site URL: `https://application-prototype.vercel.app`
   - Redirect URLs: include `https://application-prototype.vercel.app/**` and local URLs if needed
5. **Authentication → Email templates** (Magic Link)
   - Use OTP-only content with `{{ .Token }}` and remove `{{ .ConfirmationURL }}`, e.g. `Your sign-in code is {{ .Token }}`
6. **Vercel → Project → Environment variables** (Production + Preview)
   - `VITE_SUPABASE_URL=https://weyxnhykyyetquqprfnu.supabase.co`
   - `VITE_SUPABASE_ANON_KEY=<publishable/anon key from Supabase API settings>`
   - Optionally mirror as `SUPABASE_URL` / `SUPABASE_ANON_KEY` for API routes
7. Redeploy after env changes
8. Run pending SQL migrations in the Supabase SQL editor, including `*_applicant_email_otp_auth.sql`

Check project status from the CLI:

```bash
supabase projects list -o json | jq '.[] | select(.ref=="weyxnhykyyetquqprfnu") | {name, status, ref}'
```

## Email template requirement

Applicant sign-in verifies a **6-digit OTP in the app** (`verifyOtp` with `type: "email"`). Hosted Magic Link templates must expose the token and must **not** include `{{ .ConfirmationURL }}`:

```text
Your sign-in code is {{ .Token }}
```

If the template includes `{{ .ConfirmationURL }}`, Supabase sends a magic link email instead of an OTP-first email.

## Related docs

- [backend-rollout.md](./backend-rollout.md) — env vars and migration order
- [project-memory.md](./project-memory.md) — applicant auth model (no company-domain gate)
