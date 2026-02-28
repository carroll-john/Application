# Project Memory

## Purpose
This repo is a React + Vite application prototype for a university application flow derived from a Figma Make prototype. This file captures durable product, UX, and implementation decisions so future changes do not drift from the intended behavior.

## Current Stack
- Frontend: React 19, React Router, Vite, TypeScript
- Styling: Tailwind utility classes plus global tokens in `src/index.css`
- Icons: `lucide-react`
- Date inputs: `react-datepicker`
- Auth + backend target: Supabase Auth, Postgres, and Storage
- Address autocomplete: Google Places when `VITE_GOOGLE_MAPS_API_KEY` is configured, local fallback otherwise
- Shared state: `ApplicationContext` owns application data and `AuthContext` owns auth/session state
- Current package/app version: `0.0.1`
- Current live production URL: `https://application-prototype.vercel.app`

## Source Of Truth
- The Figma Make prototype is the design source of truth when screens drift.
- Figma-driven screens should preserve the existing layout language, card styling, button hierarchy, and review flow.
- Important screens that have already been tuned against the prototype include:
  - dashboard
  - qualifications
  - review and submit
  - family and support onward in Section 1

## Product And UX Rules
- Primary CTA is yellow and should be reserved for the main forward action.
- Secondary CTA is deep blue and should be used for section-level actions like save, manage, and add.
- Tertiary CTA is white or outline with blue text and border.
- Green should be used for success and completion states, not as a primary or secondary CTA color.
- Dropdown option lists must stay visually attached to the field that opened them.
- Mobile UX matters at least as much as desktop UX. Do not ship desktop-only interaction patterns.
- Review should immediately reshow the missing-fields state after a user leaves via review edit links and returns with required fields still missing.
- Applicant-profile setup now sits ahead of the deeper application flow during internal dogfooding. It should capture the applicant's name, email, preferred name, and phone without weakening the outer Keypath-only site gate.

## Shared Component Contracts

### `src/context/AuthContext.tsx`
- This is the shared auth/session provider.
- It owns Supabase session state, company-domain validation, and magic-link sign-in.
- During internal dogfooding, the company-domain gate remains on the whole site.
- Do not narrow the Keypath-only auth gate to admin routes until launch preparation explicitly begins.
- There is now a localhost-only dev bypass for temporary post-auth verification.
  - It is only available in Vite dev on `localhost` / `127.0.0.1`
  - It can be enabled from the sign-in screen or via `?dev-bypass=1`
  - It must never be treated as a preview/prod auth mode
- Company-only access is enforced in three layers:
  - sign-in form validation from `VITE_ALLOWED_EMAIL_DOMAINS`
  - session gating that rejects signed-in users whose email domain is not allowed
  - database and storage RLS backed by `public.allowed_email_domains`
- In local development, auth may bypass when Supabase env vars are not configured. That bypass is for development only and must not be treated as a production mode.

### `src/components/AppBrandHeader.tsx`
- This is the shared branded top bar for landing, overview, dashboard, and submitted-style pages.
- Prefer it over hand-built placeholder header blocks.

### `src/components/SurfaceCard.tsx`
- This is the shared neutral card shell for non-form surfaces.
- Prefer it over duplicating rounded border/shadow wrappers in dashboard, overview, and other summary pages.

### `src/components/AccentIconBadge.tsx`
- This is the shared small accent icon wrapper for branded summary surfaces and hero cards.
- Use it instead of hand-building repeated blue-tint, yellow-tint, or inverse icon badges.

### `src/components/StatusPill.tsx`
- This is the shared small status/badge primitive for info, success, warning, and neutral states.
- Prefer it over hard-coded per-page pill styling.

### `src/components/ui/button.tsx`
- Shared action semantics:
  - `default` is the yellow primary CTA
  - `soft` is the blue secondary CTA
  - `outline` is the blue outline tertiary CTA
  - `neutralOutline` is the neutral gray outline action for lower-emphasis card actions like `View course`
- Prefer these shared variants over per-page hard-coded CTA colors.

### `src/components/ui/native-select.tsx`
- This is the shared select primitive for form dropdowns.
- It should not fall back to OS-native visual dropdown menus in normal use.
- It should render as an attached custom dropdown, not a detached mobile bottom sheet.
- The dropdown should open down by default and flip up when there is not enough viewport space below.
- Selecting an option must commit the value and close the dropdown cleanly.

### `src/components/ui/date-controls.tsx`
- Date inputs use `react-datepicker`.
- Date of birth uses the date picker field, not the older split-input control.
- The date picker header should use the same custom select pattern for month and year controls rather than native select styling.
- Keep mobile and desktop behavior visually consistent with the rest of the form system.

### `src/components/ApplicationShell.tsx`
- This is the preferred shell for Section 1 style forms.
- It provides the page header, progress bar, main content spacing, and responsive footer actions.
- It should render the shared form action bar inline in the document flow.
- Do not reintroduce fixed bottom footer-style navigation on form routes.

## Data Model

### Application Context
Application state lives in `src/context/ApplicationContext.tsx`.

State is persisted in browser `localStorage` under the key `application-prototype:data`.
That persistence is required so localhost refreshes, HMR reloads, and navigation interruptions do not wipe an in-progress application.
It is now a hybrid draft model:
- local storage remains the immediate cache and offline fallback
- authenticated users also sync application drafts to Supabase through `src/lib/applicationRemoteStore.ts`
- uploaded file blobs are still local-only until the storage migration is completed

Important top-level groups:
- `applicationMeta`
- `personalDetails`
- `contactDetails`
- `tertiaryQualifications`
- `employmentExperiences`
- `professionalAccreditations`
- `secondaryQualifications`
- `languageTests`
- `cvUploaded`, `cvFileName`, and `cvDocument`

### Application Status
- The app currently models one real persisted application, not a true multi-application workspace.
- "Persisted" now means:
  - browser-local cache for immediate UX
  - Supabase-backed draft sync for authenticated users
- The real backend target remains the Supabase schema in `supabase/migrations/0001_initial.sql`.
- Submission state is stored in `applicationMeta`:
  - `applicationNumber`
  - `submittedAt`
- Course ownership is now stored in `applicationMeta.selectedCourse`:
  - `code`
  - `title`
  - `intake`
- Overview, dashboard, and backend draft persistence should read course details from `applicationMeta.selectedCourse` first, not from an implicit global MBA constant.
- `markApplicationSubmitted()` in `src/context/ApplicationContext.tsx` is the canonical client entry point for submission, but production submission now calls the Supabase `submit_application` RPC first and only falls back to client-side numbering in non-Supabase/dev mode.
- Dashboard, overview, review, and submitted pages should read from this shared state instead of inventing local application status.
- When no application has been started yet, dashboard should show an honest empty state rather than seeded mock cards.
- Applicant identity is now a separate backend concept from business-user site access:
  - `business_users` represents the authenticated Keypath employee using the site
  - `applicant_profiles` represents the applicant record being worked on inside the app
  - `applications` will attach to `applicant_profiles` over time, while site access remains Keypath-only during dogfooding
- Do not collapse applicant profile data back into the business-user auth model when building the public applicant flow.
- The applicant-profile step currently seeds `personalDetails.firstName`, `lastName`, `preferredName`, `email`, and `phone`, but those values must not cause the rest of Section 1 to be treated as complete. Real application progression still requires title, gender, and date of birth.
- Eligibility/apply should also seed the selected course before the applicant-profile step, and the applicant-profile route should be able to restore that selected course from the redirect query when needed.

### Document Uploads
- Document uploads are real client-side uploads now. They are not name-only placeholders.
- `src/lib/documentStorage.ts` is now hybrid:
  - local IndexedDB fallback in development and non-Supabase sessions
  - Supabase Storage upload path when auth, env, and an application record are available
- Application state keeps the document metadata needed for rendering and later transfer:
  - `cvDocument`
  - `tertiaryQualifications[].transcriptDocument`
  - `tertiaryQualifications[].certificateDocument`
  - `professionalAccreditations[].document`
  - `languageTests[].document`
- Keep the existing `documentName` / `cvFileName` string fields for UI compatibility, but treat the document metadata object as the canonical uploaded-file reference.
- The shared `FileUpload` component is the only upload control that should be used for these flows.
- `FileUpload` should use a label-linked native browser file input for the chooser interaction, with the real `<input type="file">` kept visually hidden and triggered through `htmlFor`.
- Do not switch back to proxy-trigger patterns like scripted `.click()` on hidden inputs, transparent overlay inputs, or heavily restyled direct native file inputs unless there is a verified browser need.
- Chrome reliability matters here. The native input approach is the current stable pattern.
- Accepted file types are PDF, DOC, DOCX, and TXT, with a 5 MB limit.
- Replacing a stored file should replace the IndexedDB blob, not just the displayed file name.
- The shared upload action model is now `add`, `view`, and `remove`. Do not reintroduce a separate `download` action unless there is a real product need for it.
- If a file is already attached, the upload panel should present the attached-file state first instead of showing a redundant chooser.
- Current backend-sync limitation:
  - authenticated document uploads can now store remotely
  - same-device editing is preserved by merging remote draft data with local document metadata when needed
  - remote storage still needs real-project verification and cleanup hardening

### Structured Address
Addresses are no longer plain strings. They use the structured address model from `src/lib/address.ts`.

Key fields:
- `formattedAddress`
- `streetAddress`
- `suburb`
- `state`
- `postcode`
- `country`

Both `residentialAddress` and `postalAddress` in `contactDetails` use this structured shape.

## Form Option Sources
- Countries come from the shared list in `src/lib/formOptions.ts`.
- Languages come from the shared list in `src/lib/formOptions.ts`.
- Shared ordering rule:
  - language selectors should surface `English` first
  - country selectors should surface `Australia` first
- Country fields with no user selection should default to an empty value plus placeholder copy such as `Select country`.

## Validation And Review Rules
- Review and submit logic lives in `src/pages/ReviewAndSubmit.tsx`.
- Required-field validation should remain visible when returning from review edit paths if the application is still incomplete.
- Review should read and display the structured address fields rather than stale free-text-only values.
- Review should show the user enough to validate their application without expanding every stored field. For addresses specifically, show the single-line residential address and the postal address only if it is different.
- Section 2 submission rule is: the user must have either at least one tertiary qualification, or both a CV and employment experience. This does not block progression through the flow, but it does block submission on review.
- Tertiary document rules are submission-time rules, not page-save rules:
  - every tertiary qualification requires a transcript before submission
  - completed tertiary qualifications also require a certificate of completion before submission
  - the edit tertiary screen must still allow save-and-continue without those documents

## Qualifications And Documents
- `TertiaryQualification` no longer has a `suspended` field. Do not reintroduce it unless the product explicitly needs that state.
- The tertiary edit screen should ask for:
  - institution
  - country
  - qualification level
  - course name
  - start date
  - end date
  - whether the qualification was completed
  - transcript upload
  - certificate upload when completed
- The tertiary supporting-documents module owns the document guidance. Avoid duplicating file-type, size-limit, and submit-rule copy inside each nested upload row.
- The transcript and certificate subpanels should carry their own visual status treatment:
  - success treatment when a document is attached
  - warning treatment when a required document is still missing
- The tertiary summary card on the qualifications screen should show `Incomplete` rather than `Completed` when a tertiary record exists but required submit-time documents are still missing.

## Integrations And Environment
- Supabase auth/deployment env vars:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_ALLOWED_EMAIL_DOMAINS`
- Supabase-backed draft sync now depends on those env vars plus an authenticated session.
- Google Places is enabled through `VITE_GOOGLE_MAPS_API_KEY`.
- The expected setup is documented in `.env.example`.
- The app is now linked to a Vercel project and deployed at `https://application-prototype.vercel.app`.
- Preview and development Vercel env vars are now configured in addition to production env vars.
- The latest known-good preview deployment for backend-submit verification was `https://application-prototype-9qwlyuygm-carroll-john-3665s-projects.vercel.app`.
- Supabase Auth must include `https://application-prototype.vercel.app/auth/callback` as a redirect URL for deployed magic-link sign-in to work.
- Server-side submission now lives in `supabase/migrations/0002_server_submit.sql` via the `submit_application` RPC and `generate_application_number()`.
- Applicant/business-user groundwork now also depends on `supabase/migrations/0003_business_users_and_applicant_profiles.sql`.
- This workspace cannot currently run `supabase db push` against the hosted project because the direct `db.*` hostname does not resolve here, so new SQL migrations should be applied in the Supabase SQL editor.
- Clean hosted test data can be reset with `supabase/reset_test_data.sql`.
- If the key is missing, address autocomplete should degrade gracefully rather than fail.
- The in-repo `.gitignore` should continue ignoring `.env` and local env variants.

## Route Map
Primary routes are defined in `src/routes.tsx`.

- Non-root routes are lazy-loaded so heavier form screens and `react-datepicker` code do not inflate the base entry bundle.
- The app now has explicit auth routes:
  - `/sign-in`
  - `/auth/callback`
- The app now also has a protected `/applicant-profile` route used during internal dogfooding to create the applicant record separately from the Keypath-authenticated business user.
- For local-only verification beyond the Keypath gate, the deterministic bypass URL is:
  - `/sign-in?dev-bypass=1&redirect=/applicant-profile?redirect=/overview`
- All application routes are protected through the shared auth gate. In dev, they may bypass when Supabase is not configured.
- Keep that global auth gate in place for the current internal-only phase, even though the backend is now starting to distinguish business users from applicant profiles.
- The root course landing page remains eagerly loaded.
- The dashboard no longer uses a fake multi-application seed or copy flow. It reflects the current persisted application only.

Important groups:
- `/` course landing
- `/overview`
- `/section1/*`
- `/section2/*`
- `/review`
- `/submitted`
- `/dashboard`
- `/profile-recommendations`

## Responsive Status
- The app is responsive in general, but not all routes are equally polished.
- Shared-shell pages in Section 1 are in better shape than some bespoke Section 2 screens.
- Known responsive outliers include screens still using more rigid mobile spacing such as:
  - `src/pages/Section2AddSecondary.tsx`
  - `src/pages/Section2AddLanguageTest.tsx`
- When editing forms, prefer the `px-4 sm:px-6 lg:px-8` style spacing pattern already used in the shared shell and stronger routes.

## Scroll And Layout Diagnosis
- Form navigation is not a site footer. It is a form action bar.
- The shared action model now lives in `src/components/FormActionBar.tsx`.
- The action bar is inline in the page flow and tagged with `data-form-action-bar` for debugging.
- Long-form routes that previously used fixed bottom mobile bars have been moved onto the shared inline action-bar pattern, including:
  - `src/pages/Section1BackgroundInfo.tsx`
  - `src/pages/Section2Qualifications.tsx`
  - `src/pages/ReviewAndSubmit.tsx`
  - `src/pages/Section2AddCV.tsx`
  - `src/pages/Section2AddSecondary.tsx`
  - `src/pages/Section2AddTertiary.tsx`
  - `src/pages/Section2AddEmployment.tsx`
  - `src/pages/Section2AddAccreditation.tsx`
  - `src/pages/Section2AddLanguageTest.tsx`
- The current live diagnosis for Section 1 and Section 2 form routes is:
  - no nested app-level scroll container
  - no fixed-height wrapper causing the form routes to stop early
  - no persistent invisible overlay on the checked routes
  - the browser document (`HTML`) is the scroll host
- A defensive scroll-lock reset exists in `src/components/ScrollToTop.tsx` and clears stale inline `overflow` styles on `html` and `body` during route changes and resizes.
- The shared action bar includes explicit trailing document space so short desktop windows can still scroll far enough to reveal the full button row.

## Known Technical Risks
- Some Section 2 pages still have bespoke layout code instead of using the shared shell patterns.
- Because this repo is design-led, visual regressions can happen quickly if shared primitives are changed without browser checks.
- Localhost can appear stale after layout/debugging changes. When behavior and source disagree, restart Vite and refresh the client before assuming the DOM matches the code.
- File-upload behavior is especially sensitive to stale localhost bundles. If a chooser stops opening after upload-control changes, restart Vite and retest in a fresh browser tab before changing the implementation again.
- The current auth restriction is strong enough for an internal beta only when the frontend allowlist is paired with the backend allowlist table and RLS from `supabase/migrations/0001_initial.sql`. For broader rollout, move to company IdP/SSO or an auth hook.
- Stale Vite processes can leave localhost serving an older uploader implementation on a different port. If upload behavior regresses unexpectedly, check for an old process still holding `5173`, restart Vite cleanly, and retest on a fresh tab before changing code again.

## Working Rules For Future Changes
- Prefer fixing shared primitives over patching the same problem screen by screen.
- Before adding new visual styling, check whether the change should extend an existing shared primitive first.
- Avoid page-local cosmetic wrappers when the behavior is not unique. Summary pages should compose existing shared pieces before introducing new markup patterns.
- Do not reintroduce one-off CTA colors, status pills, icon chips, or card shells when shared equivalents already exist.
- Remove obsolete state and prototype-only UI flows when they stop serving a real product behavior. Recent examples:
  - fake save delays and success-toasts on CV upload
  - unused upload actions
  - dead data-model fields
- Verify visual changes in the browser, especially for:
  - dropdowns
  - date pickers
  - mobile footer actions
  - review/edit-return flows
- When a screen and the prototype disagree, use the prototype unless there is a deliberate documented product reason not to.

## Shared UI Direction
- Current shared surface primitives:
  - `AppBrandHeader`
  - `SurfaceCard`
  - `FormSectionCard`
  - `StatusPill`
  - `AccentIconBadge`
  - `Button`
- If a new screen needs a card, badge, branded icon wrapper, or CTA, prefer those primitives first.
- Only add a new primitive when at least two screens need the same pattern or the pattern is structurally different from the existing set.
- Route-level lazy loading is intentional. Keep new heavy screens and date-picker consumers out of the base entry unless there is a strong reason not to.
- Vite now uses manual chunking in `vite.config.ts` to keep `react`, `supabase`, and `react-datepicker` out of one oversized entry bundle.
- The current single-course metadata is centralized in `src/lib/applicationProgress.ts` via `APPLICATION_COURSE`. Reuse it for overview, dashboard, submitted, and course landing screens instead of repeating title/intake strings.
- Backend rollout notes live in `docs/backend-rollout.md`. Keep that file aligned with `supabase/migrations/0001_initial.sql` as the persistence layer is implemented.
- Shared data types and local-cache helpers now live in `src/lib/applicationData.ts`. Backend and frontend persistence code should reuse those types instead of redefining the application shape in multiple places.

## Decision Log
- Use yellow only for the primary forward CTA.
- Use blue for section-level actions like add, save, and manage.
- Use real shared country and language datasets rather than short mock lists.
- Use structured addresses instead of a single free-text address string.
- Use attached custom dropdowns instead of detached mobile select sheets.
- Use `react-datepicker` for date inputs, with custom styling and custom month/year controls.
- Use a shared inline form action bar instead of footer-like or fixed bottom navigation on form routes.
- Treat scroll issues on form pages as layout-system problems first, not page-by-page styling problems.
- When the live browser behavior disagrees with source, verify the active dev bundle and refresh/restart before continuing diagnosis.
- For upload interactions, prefer the most native browser path available over custom UI indirection.
- Keep cleanup direction focused on reducing behavior drift as well as styling drift. If a flow is now governed by a shared rule or shared component contract, remove old local exceptions rather than preserving them out of caution.
- Route aliases for old Section 1 paths are handled inline in `src/routes.tsx`; they no longer need dedicated redirect page components.
- Dashboard and overview should prefer the shared `AppBrandHeader`, `SurfaceCard`, and `StatusPill` primitives instead of one-off card and badge shells.
- The old fake dashboard inventory and copy-from-application seed have been removed. Do not reintroduce seeded application cards or a mock multi-application modal unless the app gains a real multi-application data model first.
- Summary and hero-style pages should prefer `AccentIconBadge` for repeated branded icon chips.
- Route-level lazy loading is the current bundle-size strategy, and `react-datepicker` CSS now loads with the date-controls module instead of the base entry.
- Cleanup direction is to reduce unnecessary customization, not create new one-off styling islands. Shared component extension beats page-specific cosmetics by default.
