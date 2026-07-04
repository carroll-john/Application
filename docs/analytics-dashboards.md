# Reading the Analytics Dashboards

A plain-English guide to the three pinned PostHog dashboards (EU cloud,
project `133929`). For the event definitions behind them see
`docs/analytics-events.md`; for the integration/runbook side see
`docs/posthog-integrations.md`.

## Ground rules for reading any insight

- **Filter test traffic.** Authorised QA-bot sessions stamp every event with
  `synthetic_test: true`, and the project's *internal & test accounts* filter
  (`synthetic_test is_not_set`) excludes them. Keep "filter test accounts"
  ON when reading real applicant numbers; turn it OFF only to validate
  instrumentation after a bot run.
- **Watch the date range.** Events before 2026-06 predate the Phase 0–8
  analytics overhaul: legacy `funnel_step_N_*` duplicates existed and the 23
  `application_submit_*` events from March 2026 belong to the pre-overhaul app.
  When in doubt, start ranges at 2026-06-21.
- **Every event carries context.** `course_code` / `course_provider` /
  `course_intake`, `application_id` / `application_number` /
  `application_status`, and `page_*` properties are available for breakdowns
  on nearly every application event.

## 1. Applicant journey & activation ([dashboard 761609](https://eu.posthog.com/project/133929/dashboard/761609))

Answers: *where do applicants drop out between finding a course and
submitting?*

- **Core funnel** — the ordered sequence
  `application_start_requested` → `application_draft_created` →
  `application_step_viewed` → `application_step_completed` →
  `application_submit_started` → `application_submitted`.
  A step's drop-off means the applicant never performed the *next* action, not
  that they left the site. Break down by `course_provider` to compare
  institutions.
- **Steps reached** (`application_step_viewed` by `application_step_key`) —
  which form step is the deepest one applicants see. Step keys follow the
  application order (`basic_information` … `review_and_submit`).
- **Submit blockers** (`application_submit_blocked` by
  `application_step_key` / `validation_issue_codes`) — what validation stops a
  submit attempt. `validation_issue_codes` values look like
  `step_key:field_slug`, so one insight shows both the step and the exact
  field.

## 2. Document parsing & AI eligibility ([dashboard 761610](https://eu.posthog.com/project/133929/dashboard/761610))

Answers: *do the document parsers and the AI eligibility check actually help
applicants?*

- **Parser outcomes** — `cv_parser_draft_*` and
  `tertiary_transcript_parser_draft_*` (`succeeded` / `empty` / `failed`)
  with `parse_duration_ms` percentiles. "Empty" means the parser ran but
  extracted nothing usable — a quality signal, not an error.
- **AI generations** — `$ai_generation` (server-side) latency and volume for
  the transcript eligibility pipeline.
- **Human corrections** — `eligibility_check_override` (server) is admissions
  or applicant feedback that an automated requirement check was wrong; the gap
  between generations and overrides approximates the correction rate. The
  client companion `eligibility_feedback_submitted` carries the applicant's
  hashed distinct id, so it can join back to the person and their funnel —
  the server event cannot.
- **Evidence flow (doc-first hub)** — `application_evidence_prompt_viewed`
  shows which evidence the hub asks for and how many prompts remain
  (`outstanding_prompt_count`); `application_evidence_section_skipped`
  by `evidence_section_key` shows which requests applicants decline.
  A high skip rate on a section that later blocks submits is a copy/UX
  problem, not an applicant problem.

## 3. Auth & quality ([dashboard 761612](https://eu.posthog.com/project/133929/dashboard/761612))

Answers: *can people get in, and is the app healthy?*

- **Sign-in / sign-up outcomes** — `auth_sign_in_*`, `auth_sign_up_*`
  attempted vs succeeded/failed; `auth_gate_opened` counts the in-flow auth
  modal (eligibility/apply), i.e. demand from anonymous users.
- **Exceptions** — `$exception` volume. Sentry issues are tagged
  `posthog_distinct_id`, so an error spike here can be traced to the affected
  people (and their session replays on public routes) in PostHog.

## Known caveats (current)

- The funnel's submit steps stay sparse until real submissions occur or the
  synthetic bot (`npm run funnel:bot`) runs against a preview deploy — see
  `docs/analytics-events.md` §Synthetic Test Traffic.
- Session replay only runs on public catalog routes; authenticated routes are
  deliberately excluded (PII).

## Dashboard maintenance checklist (PostHog UI, EU project 133929)

One-time actions to apply in the PostHog UI (they cannot ship from this
repo):

- [ ] Verify the *internal & test accounts* filter (`synthetic_test
      is_not_set`) is enabled on every tile of all three dashboards.
- [ ] Add a submit-blocker breakdown by `validation_issue_codes` to
      dashboard 761609 (currently by step only).
- [ ] Add evidence-flow tiles to dashboard 761610:
      `application_evidence_prompt_viewed` trend by `evidence_section_key`,
      skip rate (`application_evidence_section_skipped` /
      `application_evidence_prompt_viewed`), and
      `eligibility_feedback_submitted` vs `eligibility_check_override` volume.
- [ ] Pin a link to this guide in each dashboard's description.
