# UC Assessment MVP Isolation and Pilot Runbook

## Frozen demo — do not change

Until John explicitly confirms the next-week session has finished:

- Alias: `https://uc-vc-demo.vercel.app`
- Pinned deployment: `dpl_DLFwvtFngQFTBCaFJhFL2Xfh9Zxk`
- Restore target: `application-prototype-hs6k75e5h-carroll-john-3665s-projects.vercel.app`
- Recorded state: Ready, preview target

Do not change the demo worktree, alias, branch environment, Supabase project, or
deployment. Do not run `vercel promote`, `vercel --prod`, or attach the alias to
an MVP deployment. Do not merge `codex/uc-assessment-mvp` into `master` before
the session. Merge and alias changes are later, separate release decisions.

## MVP-only infrastructure

| Dependency | Required boundary |
| --- | --- |
| Vercel | Project `application-uc-mvp`; generated preview URLs only. |
| Supabase | New pilot project; private assessment bucket and this branch's migrations only. |
| PostHog | Separate pilot project; explicit privacy-safe events only. |
| Sentry | Environment `uc-assessment-mvp`; browser replay sampling zero. |
| Eligibility service | Dedicated staging deployment and token; never the demo target. |
| Malware scanning | Private authenticated scanner; deployed flows fail closed when absent. |

Before any development deployment, pull the MVP environment and run
`npm run check:uc-mvp-isolation`. The check must prove different Vercel,
Supabase, PostHog, and eligibility target IDs; matching MVP Supabase URLs; UC MVP
Sentry names; and no demo alias/database target in runtime endpoints.

### Provisioned boundary status — 4 August 2026

| Boundary | Current status |
| --- | --- |
| Frozen demo | Rechecked Ready at the pinned deployment and alias above; unchanged. |
| MVP Vercel | Project `application-uc-mvp`, ID `prj_GIr9VDBZq6V4C5Imw0iX3arKyVJe`; no MVP deployment or alias created. |
| MVP Supabase | Project `Application UC MVP`, ref `vhegyhjqoahjcdseucfd`; pilot migrations applied. |
| PostHog | Separate project still required. Do not reuse the existing Application Proto project. |
| Sentry | `uc-assessment-mvp` environment is wired in code; pilot DSN/environment variables still required. |
| Eligibility | Dedicated staging service still required; the existing shared service was not changed. |
| Malware scanning | Authenticated HTTPS scanner endpoint/token still required. |

Keep treatment disabled and do not deploy until every row is isolated and
`check:uc-mvp-isolation` passes with the final environment. Git connection may
be used to configure branch-scoped variables, but it must not trigger a preview
before this proof is recorded.

## Safe launch order

1. Refresh the 33-course catalogue and governed source dates. CI rejects governed
   sources older than 30 days.
2. Obtain named UC approval for all four governed mappings and caps. Commit the
   approval metadata, then set the exact approved rules version in the pilot only.
3. Create and confirm pre-invited participant accounts. Store only hashed invite
   tokens; assign the user ID before sending the invitation. Prepare an exact
   100-row `{email,userId}` roster, verify every account is already confirmed,
   then run `npm run pilot:provision -- --input roster.json --output invitations.json --start <ISO time>`.
   The script refuses demo targets, creates an exact 50/50 allocation, sets the
   six-week expiry, stores hashes only, and writes the send list with owner-only
   permissions. Treat that output as a secret and delete it after invitations are sent.
4. Keep `UC_ASSESSMENT_TREATMENT_ENABLED=false` through staff dogfooding. Validate
   control remains available, then run a ten-user alpha.
5. Enable treatment only after all release and safety gates pass. Any unsupported
   numeric claim or access-control failure immediately sets the switch to `false`;
   the control journey remains available.

## Release gates

- Context, governance freshness, lint, unit/contract, API ESM, build, and
  accessibility checks pass.
- Desktop/mobile control and treatment flows pass, including refresh/resume,
  parser failure, expiry, application handoff, submission, reviewer TOTP, and ZIP
  export.
- Live CV and transcript LLM regressions pass. A skipped live job is not a release
  pass.
- The dependency audit currently reports the React Router RSC-mode CSRF advisory
  `GHSA-qwww-vcr4-c8h2`. This Vite SPA does not use React Server Components or
  server actions, but the high-severity audit result remains visible. Upgrade to
  a patched supported release when available or obtain a documented security
  acceptance before pilot launch; do not hide or suppress the advisory.
- Zero unsupported/above-cap claims; every insufficient/low-confidence result is
  manual review; reviewer agreement is at least 90%; processing success is at
  least 95% with p95 under 90 seconds; no critical privacy, security, cross-user,
  or accessibility defect.
- Pilot analysis uses activated invitations as denominator and requires at least
  a 10-percentage-point treatment uplift in application starts, subject to every
  safety gate.

## Retention and incident response

The daily retention job deletes abandoned, unpromoted assessment files after 30
days. Promoted evidence follows the application policy. Preserve audit records.
If treatment is disabled, do not alter cohort assignment; activation returns the
effective control journey while retaining the original allocation for analysis.
