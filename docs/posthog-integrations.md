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

- The **reverse proxy** is already in `vercel.json` (Phase 2: `/ingest/*`).
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

### Status / caveats (as of first build)

- **Live data present:** funnel through `application_step_completed`,
  `$ai_generation` (~40/30d), `eligibility_check_override`, both parsers, auth,
  and `$exception` all populate.
- **Empty but ready:** `application_submit_started` / `application_submitted` /
  `application_submit_blocked` have never fired (no real submission has reached
  `/review` yet), so the funnel's last two steps and the submit-blocker tile show
  zero until a real submission occurs.
- The Phase 0–8 production deploy landed 2026-06-19; legacy `funnel_step_N_*`
  duplicate events all predate it and should stop — re-check after real traffic.

Re-run / extend with the PostHog MCP (`query-funnel`, `query-trends`,
`insight-create`, `dashboard-create`, …).

## Linear

Part of the **DIS-202** PostHog analytics rollout (and DIS-195 / DIS-196 /
DIS-197 / DIS-180).
