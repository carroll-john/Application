# PostHog Integrations & Dashboards (runbook)

Phase 8 of the analytics overhaul wires PostHog into the rest of the stack. The
code-level link ships in this repo; the rest are one-time setup steps in the
PostHog / Sentry / Supabase / Vercel dashboards (they can't be done from app
code). Project: **EU** cloud, `eu.posthog.com`, project `133929`.

## 1. Sentry ↔ PostHog

**In code (this repo):** `src/lib/sentry.ts` tags every Sentry event with
`posthog_distinct_id` (via `posthog.get_distinct_id()`), so from a Sentry issue
you can find the person — and their session replay / events — in PostHog.

> We wire this manually instead of using `posthog-js`'s built-in
> `sentryIntegration`, because that integration targets the legacy
> `setupOnce(getCurrentHub)` API that `@sentry/react` v10 removed.

**In the PostHog UI (optional, for the reverse link):**
- Data pipeline → **Sources** → add **Sentry** to pull issues into PostHog, or
- Use the `posthog_distinct_id` tag in Sentry to deep-link back. To search a
  Sentry issue's person in PostHog: filter persons by the distinct id.

## 2. Supabase → PostHog data warehouse

Join product tables (applications, courses) with analytics so funnels can be
segmented by real application state.

1. Create a **read-only** Postgres role in Supabase limited to the tables you
   want exposed (do **not** reuse the service role).
2. PostHog → Data pipeline → **Sources** → **Postgres** → enter the Supabase
   connection string (host/port/db/user/password) + the schema/tables.
3. Schedule the sync; then join in SQL insights, e.g. analytics events ⋈
   `applications` on a (hashed) application id.

Keep credentials in PostHog's source config only — never in this repo.

## 3. Vercel ↔ PostHog

- ⚠️ **The `/ingest/*` reverse proxy is currently broken** — on the deployment it
  returns **404** for every analytics path (`/ingest/i/v0/e/`, `/ingest/flags/`,
  `/ingest/s/`), so all capture/flags/session POSTs were silently dropped and
  **no events reached PostHog** since the proxy shipped (DIS-196). As a result
  `src/lib/analytics/posthogClient.ts` now sends analytics **directly** to
  `VITE_POSTHOG_HOST` (`https://eu.i.posthog.com`) — the proven pre-proxy path —
  instead of `/ingest`. Re-enable the proxy (set `api_host` back to `/ingest`)
  only once `https://<deploy>/ingest/flags/` returns 200 end-to-end; the
  `vercel.json` rewrite matches PostHog's canonical pattern, so the fault is in
  how the rewrite is applied on the deployment, not the rule itself.
- The **reverse proxy** is still defined in `vercel.json` (Phase 2: `/ingest/*`).
- Optionally install the **PostHog Vercel integration** to auto-inject
  `VITE_POSTHOG_KEY` / host into the project's env (instead of setting them by
  hand). It does not replace the proxy.

## 4. Dashboards & funnels (built)

Three pinned dashboards are live in EU project `133929`, built from the events
in `docs/analytics-events.md`:

- **[Applicant journey & activation](https://eu.posthog.com/project/133929/dashboard/761609)**
  — Core application funnel (`application_start_requested` →
  `application_draft_created` → `application_step_viewed` →
  `application_step_completed` → `application_submit_started` →
  `application_submitted`, ordered; toggle a `course_provider` / `storage_mode`
  breakdown in-UI), daily activation trend, steps reached by
  `application_step_key`, and submit blockers (`application_submit_blocked` by
  step — DIS-197).
- **[Document parsing & AI eligibility](https://eu.posthog.com/project/133929/dashboard/761610)**
  — CV + transcript parser outcomes (`*_draft_succeeded` / `_empty` / `_failed`),
  CV `parse_duration_ms` p50/p95, AI `$ai_generation` latency p50/p95, generations
  vs `eligibility_check_override` volume (the gap = human-correction rate), and
  `eligibility_outcome` distribution.
- **[Auth & quality](https://eu.posthog.com/project/133929/dashboard/761612)** —
  sign-in / sign-up / OTP outcomes and `$exception` volume.

### Status / caveats (re-verified 2026-06-26, DIS-196)

Per-stage event volume (all-time, EU project `133929`):

| Funnel stage | Events |
| --- | --- |
| `application_start_requested` | 47 |
| `application_draft_created` | 56 |
| `application_step_viewed` | 982 |
| `application_step_completed` | 681 |
| `application_submit_started` | 23 |
| `application_submitted` | 23 |

- **Top of funnel populates** (start → draft → step viewed → step completed).
- **Submit steps are still effectively empty.** The only `application_submit_started` /
  `application_submitted` events (23 each) are stale — they all fired in a single
  week in **early March 2026**, predate the Phase 0–8 overhaul, and carry **no**
  `synthetic_test` tag. **Zero** submissions have reached `/review` since the
  2026-06-19 deploy. So the funnel's last two steps and the submit-blocker tile
  read as empty for the current app until a real submission occurs.
- **The synthetic QA bot has never run against this project.** There are **no
  `synthetic_test`-tagged events of any kind** in `133929`, so the bot
  (`scripts/synthetic-funnel-bot.mjs`, merged in #125–128) has not yet driven an
  end-to-end submission here. Its logic correctly handles both conditional
  submission requirements (it unchecks "completed" to avoid the certificate-of-
  completion rule; the `overseas-english` / `ahpra-nurse` personas evidence
  English proficiency), so populating the submit steps is a matter of *running*
  it — `npm run funnel:bot` with `BASE_URL`, `SYNTHETIC_TOKEN`,
  `TEST_EMAIL`/`TEST_PASSWORD` set against a deploy whose
  `VITE_ANALYTICS_SYNTHETIC_TOKEN` matches — or of real submission traffic.
- **Legacy `funnel_step_N_*` duplicates have stopped.** Confirmed 0 since the week
  of 2026-06-21 (last fired the week of 2026-06-14, pre-deploy).

Re-run / extend with the PostHog MCP (`query-funnel`, `query-trends`,
`insight-create`, `dashboard-create`, …).

## Linear

Part of the **DIS-202** PostHog analytics rollout (and DIS-195 / DIS-196 /
DIS-197 / DIS-180).
