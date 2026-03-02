# Project Memory

## Purpose
This file stores durable product, UX, and implementation rules for the application prototype. Keep it short. Put temporary phase state in `docs/current-phase.md` and one-off scope details in `docs/demo-scope-tuesday.md`.

## Core Product Rules
- The app should follow the Figma Make prototype unless a newer documented decision overrides it.
- Primary CTA is yellow and reserved for the main forward action.
- Secondary CTA is deep blue and used for save, manage, add, and other section actions.
- Tertiary CTA is white or outline with blue text and border.
- Form navigation belongs to the form layout, not the site footer. Use the shared form action bar.
- Mobile UX matters as much as desktop UX.
- Review should immediately reshow missing-fields state after a user returns from an edit path with unresolved validation issues.
- Submission requirements and page-save requirements are separate unless the product explicitly says otherwise.

## Auth And Identity
- The current Tuesday-demo model uses a company-email gate on `/sign-in` with no OTP or magic-link step.
- Access remains restricted to `@keypathedu.com.au` during dogfooding.
- Do not reintroduce OTP, magic-link, or a second inner pseudo-auth layer for applicants.
- In the current flow, the company email unlocks local prototype access and the applicant profile is managed locally unless a newer auth decision restores real sessions.
- `/profile` is profile management, not an auth step.
- Reusable profile fields are limited to email, first name, and last name.
- Profile changes affect future applications by default. Existing applications keep the values they were created with.
- After the Keypath email gate, users should land on the intended course or app route, or `/` by default.
- A localhost-only auth bypass exists for local verification. It must stay dev-only and must never affect preview or production behavior.

## Course And Application Model
- The app supports multiple applications per signed-in user.
- Tuesday-demo rule: one open draft per course, with submitted applications retained separately.
- The selected course is part of the persisted application and must be stored in `applicationMeta.selectedCourse`.
- Eligibility is course-specific.
- Do not bypass eligibility with a direct apply shortcut on the course page.
- Course catalog source of truth is `src/data/courses.raw.json`, mapped through `src/lib/courseCatalog.ts`.
- Preserve raw academic source fields such as `subjectArea`, `coreSubjects`, and `recognitionOfPriorLearning`.
- Visible course category chips should be normalized to `Business`, `Technology`, and `Health`. A course may show more than one.
- Intake labels should be normalized to month-style labels where possible.
- Fees should be shown as simple approximate fee figures.
- Support options should be kept separate from fees and normalized to the fixed labels `CSP`, `FEE-HELP`, and `HECS-HELP`.
- Where pricing is per unit or per subject, normalize the headline fee to an approximate annual figure based on 8 units or subjects.
- Normalize duration to year-based labels where possible, preferably `x.y years full-time or part-time equivalent`.

## Shared UI Contracts
- Prefer shared primitives over page-local wrappers.
- Use `AppBrandHeader` for branded top bars on browse, overview, dashboard, and similar summary surfaces.
- Use `SurfaceCard`, `StatusPill`, `AccentIconBadge`, and shared button variants before creating new local treatments.
- `FileUpload` is the shared uploader and should keep the native label-linked file input pattern.
- Upload actions should stay minimal and consistent: `add`, `view`, `remove`.
- `native-select` should keep dropdowns visually attached to the field that opened them.

## State And Persistence
- `ApplicationContext` is the shared application state layer.
- It currently runs in local-first mode for the Tuesday demo because the access gate no longer creates a real Supabase session.
- Keep shared draft persistence in `ApplicationContext`; do not scatter it into page-local state.
- Shared application types and local cache helpers live in `src/lib/applicationData.ts`.
- Document storage should fall back cleanly to local IndexedDB when no authenticated Supabase session is present.

## Validation Rules
- Section 2 submission rule: the user must have either at least one tertiary qualification, or both a CV and employment experience.
- Tertiary document requirements are submission-gated, not save-gated:
  - every tertiary qualification requires a transcript before submission
  - completed tertiary qualifications also require a certificate before submission
- Review should show enough data to validate the application without dumping every stored field.

## Integrations
- Auth, database, and storage target: Supabase.
- Hosting target: Vercel at `https://application-prototype.vercel.app`.
- Address autocomplete uses Google Places when `VITE_GOOGLE_MAPS_API_KEY` is configured, with local fallback otherwise.
- Server-backed submission depends on `supabase/migrations/0002_server_submit.sql` and the `submit_application` RPC.
- Business-user and applicant-profile separation depends on `supabase/migrations/0003_business_users_and_applicant_profiles.sql`.

## Operational Rules
- Keep `docs/backend-rollout.md` aligned with backend assumptions and migration requirements.
- Use `supabase/reset_test_data.sql` plus a private/incognito browser session for clean hosted test runs.
- If localhost behavior and source disagree, check for a stale Vite process and retest in a fresh browser tab before refactoring.
- When cleaning up, remove dead prototype-era state and behavior rather than carrying it forward.
