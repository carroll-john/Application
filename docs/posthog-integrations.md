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

## 4. Dashboards & funnels to build (PostHog UI / MCP)

Build these from the events documented in `docs/analytics-events.md`:

- **Application funnel** (core): `application_start_requested` →
  `application_draft_created` → `application_step_viewed` →
  `application_step_completed` → `application_submit_started` →
  `application_submitted`. Break down by the `course_provider` group.
- **Activation / retention:** new vs returning, and return-to-submit retention.
- **Where applicants get stuck (DIS-197):** `application_submit_blocked` broken
  down by `application_step_key` / validation properties.
- **Parser success:** CV + transcript `*_draft_succeeded / _empty / _failed`
  with `parse_duration_ms`.
- **AI eligibility:** the server `$ai_generation` events (model, tokens,
  latency, outcome).

These can be created with the PostHog MCP (`query-funnel`, `query-trends`,
`dashboard-create`, …) once an interactive session can approve the calls.

## Linear

Part of the **DIS-202** PostHog analytics rollout (and DIS-195 / DIS-196 /
DIS-197 / DIS-180).
