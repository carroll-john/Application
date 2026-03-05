# Analytics Events

This app sends page and funnel events to PostHog through `src/lib/posthog.ts`.

## Consent And Identity

- Analytics capture is disabled by default until consent is granted (`application-prototype:analytics-consent=granted`), unless overridden by `VITE_ANALYTICS_CONSENT_DEFAULT`.
- PostHog runs in manual mode (`autocapture: false`), so only explicit app events are sent.
- PostHog user identity uses a salted hash (raw email/user IDs are not used as analytics distinct IDs).
- `applicant_profile_id` event property is hashed before capture.

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

## Required Funnel Step Events (3-5)

These explicit events are emitted in addition to their source events so funnel
reporting can target a stable required step series across platforms.

| Explicit event | Source event | Required step |
| --- | --- | --- |
| `funnel_step_3_application_step_viewed` | `application_step_viewed` | 3 |
| `funnel_step_4_application_step_completed` | `application_step_completed` | 4 |
| `funnel_step_5_application_submit_started` | `application_submit_started` | 5 |

Platform setup:
- PostHog: use the explicit `funnel_step_3_*` to `funnel_step_5_*` events directly in funnels.
- Clarity: the same explicit event names are sent as Clarity custom events when Clarity tracking is active.

Important submit-path rules:

- `application_submit_started` fires only when the user clicks `Submit application` on `/review` and there are no validation errors.
- `application_submit_blocked` fires instead when required fields are still missing.
- `application_submitted` fires only after the final submit succeeds.
- `application_submit_failed` fires when the submit attempt starts but the backend/local submit path throws.

## Auth Events

| Event | Trigger |
| --- | --- |
| `auth_magic_link_requested` | User submits the sign-in form |
| `auth_magic_link_sent` | Supabase accepts the magic-link request |
| `auth_magic_link_failed` | Supabase rejects the magic-link request |
| `auth_magic_link_completed` | User returns through `/auth/callback` with an authorized session |

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

## Bot And Agent Exclusion

Client-side PostHog capture is disabled for detected automation or bot traffic before events are sent.

Capture is also disabled when analytics consent is denied.

Current exclusion checks:

- `navigator.webdriver === true`
- Playwright runtime marker on `window`
- Cypress runtime marker on `window`
- User-agent matches common automation tooling (`playwright`, `puppeteer`, `cypress`, `selenium`, `webdriver`, `postmanruntime`, `curl`, `wget`, `python-requests`, etc.)
- User-agent matches known crawler/bot patterns (`bot`, `spider`, `crawl`, `headless`, `gptbot`, `chatgpt-user`, `claudebot`, `perplexitybot`, `facebookexternalhit`, `ahrefsbot`, `semrushbot`, etc.)

This filtering only affects new sessions after deployment. Existing historical events remain in PostHog.
