# Analytics Events

This app sends page and funnel events to PostHog through `src/lib/posthog.ts`.

## Identity

- PostHog runs in manual mode (`autocapture: false`), so only explicit app events are sent.
- PostHog user identity uses a salted hash (raw email/user IDs are not used as analytics distinct IDs).
- `applicant_profile_id` event property is hashed before capture.

## URL privacy

- `$pageview` `$current_url` is sanitized: URL fragments (hash) are stripped and auth-related query parameters are removed before capture.
- PostHog does not capture pageviews on `/auth/callback` (magic-link tokens must not reach analytics).
- `/sign-in` pageviews are skipped when the query string contains auth tokens.

## Page Naming

`$pageview` events now include:

- `page_name`: human-readable page label
- `page_key`: stable machine-friendly key
- `page_group`: high-level bucket for filtering

Current page names:

| Route pattern | page_name | page_key | page_group |
| --- | --- | --- | --- |
| `/` | Course catalog | `course_catalog` | `catalog` |
| `/courses/:courseCode` | Course details | `course_details` | `catalog` |
| `/sign-in` | Sign in | `sign_in` | `auth` |
| `/auth/callback` | Auth callback | `auth_callback` | `auth` |
| `/profile` | Applicant profile | `profile` | `profile` |
| `/dashboard` | Application dashboard | `dashboard` | `dashboard` |
| `/overview` | Application overview | `application_overview` | `application` |
| `/section1/basic-info` | Basic information | `basic_information` | `application` |
| `/section1/personal-contact` | Personal contact details | `personal_contact_details` | `application` |
| `/section1/contact-info` | Citizenship information | `citizenship_information` | `application` |
| `/section1/address` | Address details | `address_details` | `application` |
| `/section1/cultural-background` | Cultural background | `cultural_background` | `application` |
| `/section1/family-support` | Family support | `family_support` | `application` |
| `/section2/qualifications` | Qualifications overview | `qualifications_overview` | `application` |
| `/section2/add-tertiary`, `/section2/edit-tertiary/:id` | Tertiary qualification | `tertiary_qualification` | `application` |
| `/section2/add-employment`, `/section2/edit-employment/:id` | Employment experience | `employment_experience` | `application` |
| `/section2/add-accreditation`, `/section2/edit-accreditation/:id` | Professional accreditation | `professional_accreditation` | `application` |
| `/section2/add-secondary`, `/section2/edit-secondary/:id` | Secondary qualification | `secondary_qualification` | `application` |
| `/section2/add-language-test`, `/section2/edit-language-test/:id` | Language test | `language_test` | `application` |
| `/section2/add-cv` | CV upload | `cv_upload` | `application` |
| `/review` | Review and submit | `review_and_submit` | `application` |
| `/submitted` | Application submitted | `application_submitted` | `application` |
| `/profile-recommendations` | Profile recommendations | `profile_recommendations` | `application` |

## Core Funnel Events

Recommended main application funnel:

1. `application_start_requested`
2. `application_draft_created`
3. `application_step_viewed`
4. `application_step_completed`
5. `application_submit_started`
6. `application_submitted`

## Building the funnel in PostHog

Funnels are built natively in PostHog directly from the source events above —
there are no separate `funnel_step_*` events (these were removed; PostHog
constructs the funnel from the real events). Define the funnel as the ordered
sequence:

`application_start_requested` → `application_draft_created` →
`application_step_viewed` → `application_step_completed` →
`application_submit_started` → `application_submitted`

Each step already carries `application_step_order` / `application_step_key`
plus course and application context, which can be used for funnel breakdowns.

The funnel and its supporting charts are built as three pinned PostHog
dashboards (EU project `133929`) — see `docs/posthog-integrations.md` §4 for the
links and current data caveats.

Important submit-path rules:

- `application_submit_started` fires only when the user clicks `Submit application` on `/review` and there are no validation errors.
- `application_submit_blocked` fires instead when required fields are still missing.
  Includes `validation_error_count`, `field_names`, `primary_field`, `blocked_step_keys`,
  `blocked_step_labels`, `application_step_key` / `application_step_label` (first blocked
  step in funnel order), `submit_page_key`, and stable `validation_issue_codes`
  (`application_step_key:field_slug`) for breakdowns.
- `application_submitted` fires only after the final submit succeeds.
- `application_submit_failed` fires when the submit attempt starts but the backend/local submit path throws.

## Auth Events

| Event | Trigger |
| --- | --- |
| `auth_sign_in_attempted` | User submits the sign-in form |
| `auth_sign_in_succeeded` | Password sign-in establishes a session |
| `auth_sign_in_failed` | Password sign-in is rejected |
| `auth_sign_up_attempted` | User submits the create-account form |
| `auth_sign_up_confirmation_sent` | Supabase accepts sign-up and sends a confirmation email |
| `auth_sign_up_failed` | Create-account sign-up is rejected |
| `auth_password_reset_completed` | User saves a new password after opening a reset link |
| `auth_gate_opened` | An in-flow auth modal opens from eligibility or apply |
| `local_draft_import_started` | Signed-in user starts importing local anonymous drafts |
| `local_draft_import_completed` | Local draft import completes without failed drafts |
| `local_draft_import_failed` | Local draft import leaves one or more drafts unimported |

## Application Progress Events

| Event | Trigger |
| --- | --- |
| `eligibility_check_opened` | User opens the eligibility modal |
| `eligibility_check_completed` | User completes the eligibility modal |
| `application_sign_in_redirected` | Anonymous user tries to apply and is sent to sign-in |
| `application_draft_created` | A new draft is created for the selected course |
| `application_draft_resumed` | An existing draft is reopened for the selected course |
| `application_opened_from_dashboard` | User opens an application card from the dashboard |
| `application_saved_for_later` | User clicks `Save & Exit` from a tracked application step |
| `application_step_viewed` | User lands on a tracked application step |
| `application_step_completed` | User clicks the primary CTA on a tracked application step |

## Record Update Events

These all include application context such as course, application id/number, status, and item counts where relevant.

| Event |
| --- |
| `application_cv_saved` |
| `application_cv_removed` |
| `application_employment_experience_saved` |
| `application_employment_experience_removed` |
| `application_tertiary_qualification_saved` |
| `application_tertiary_qualification_removed` |
| `application_secondary_qualification_saved` |
| `application_secondary_qualification_removed` |
| `application_language_test_saved` |
| `application_language_test_removed` |
| `application_professional_accreditation_saved` |
| `application_professional_accreditation_removed` |

## Useful Properties

Common properties now available across page and funnel events:

- `page_name`
- `page_key`
- `page_group`
- `course_code`
- `course_title`
- `course_provider`
- `course_intake`
- `application_id`
- `application_number`
- `application_status`
- `applicant_profile_id`

Application-step events also include:

- `application_step_label`
- `application_step_key`
- `application_step_group`
- `application_step_order`

## Feature Flags

Flag reads are typed via a `FeatureFlagKey` union (`src/lib/analytics/featureFlags.ts`) — keep it in sync with the flags defined in the PostHog project.

- **React:** `useFeatureFlag(key)` (`src/hooks/useFeatureFlag.ts`) over `posthog-js/react`. The app tree is wrapped in `<PostHogProvider client={posthog}>` (`src/App.tsx`).
- **Imperative:** `isFeatureFlagEnabled(key)` / `getFeatureFlagPayload(key)` from `src/lib/posthog.ts`.
- **Resolution / freshness:** for first-time users a flag is `undefined` until the `/flags` response arrives; the wrapper treats that as `false` (control/default variant, no flicker). For returning users posthog-js returns the value cached in localStorage immediately, which may briefly be stale until the fresh response arrives — gate kill-switch / freshness-sensitive flags on `posthog.onFeatureFlags` rather than the cached value. Experiment exposure is tracked automatically by the hook.

## Bot And Agent Exclusion

Client-side PostHog capture is disabled for detected automation or bot traffic before events are sent.

Current exclusion checks:

- `navigator.webdriver === true`
- Playwright runtime marker on `window`
- Cypress runtime marker on `window`
- User-agent matches common automation tooling (`playwright`, `puppeteer`, `cypress`, `selenium`, `webdriver`, `postmanruntime`, `curl`, `wget`, `python-requests`, etc.)
- User-agent matches known crawler/bot patterns (`bot`, `spider`, `crawl`, `headless`, `gptbot`, `chatgpt-user`, `claudebot`, `perplexitybot`, `facebookexternalhit`, `ahrefsbot`, `semrushbot`, etc.)

This filtering only affects new sessions after deployment. Existing historical events remain in PostHog.

## Synthetic Test Traffic (authorised QA bot)

Because bot/automation traffic is dropped, an end-to-end QA bot needs a
deliberate, gated doorway:

- Set `VITE_ANALYTICS_SYNTHETIC_TOKEN` (a long random value) on the **preview /
  QA deployment only** — leave it unset in normal production, which keeps the
  doorway closed.
- Load the app with `?kp_synthetic=<token>`. A matching token bypasses the
  bot filter (persisted to `localStorage` for the session) and stamps every
  event with the `synthetic_test: true` super-property.
- `synthetic_test` is already registered under the project's **internal & test
  accounts** filter (`synthetic_test is_not_set`), so turning on "filter test
  accounts" on any insight/dashboard excludes the synthetic run. Toggle it off to
  *see* the synthetic data (useful for validating the funnel / blocker tiles).
- Driver script: `scripts/synthetic-funnel-bot.mjs` (Playwright). It activates
  the doorway, signs in (`TEST_EMAIL`/`TEST_PASSWORD`), tallies `/ingest/*` POSTs
  as proof of capture, and drives the full journey — eligibility → start → the six
  Section 1 steps → a tertiary qualification → submit (`application_submitted`,
  DIS-196) — plus a `MODE=blocked` path for `application_submit_blocked` (DIS-197).
  Selectors are mapped from the components (no `data-testid`s exist), so a live
  run may need minor tweaks; every step logs, so mismatches are obvious.
- Personas (`scripts/synthetic-personas.mjs`, selected with `PERSONA=<key>`) supply
  the field values and a drop-off behaviour, so each run is a believable applicant
  (varied `course_provider`, citizenship, `eligibility_outcome`, and funnel drop-off)
  rather than generic data. `TRANSCRIPT_PATH` / `CV_PATH` upload real documents to
  exercise the parsers + AI eligibility. Add personas freely.
- A persona can also supply `languageTest` or `accreditation`, which drive the
  `addLanguageTest` / `addAccreditation` steps. These double as end-to-end checks for
  the conditional English-proficiency requirement: `overseas-english` (overseas,
  non-English transcript → satisfies English with an IELTS test) and `ahpra-nurse`
  (same, but satisfies it with an AHPRA "Registered Nurse" registration instead).
  Both must reach `/submitted`; if the submit RPC over-blocks, they stall on `/review`.

Submissions write real rows to Supabase (and can trigger eligibility AI /
emails), so run against a preview environment and/or clean up the test
applications afterwards.
