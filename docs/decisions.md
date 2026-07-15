# Decisions

## 2026-03-01

### Company-domain gate for the Tuesday demo
- Use a Keypath email-domain gate on `/sign-in`.
- Restrict access to `@keypathedu.com.au` during dogfooding.
- Do not use OTP, magic-link, or a second inner applicant login flow for the current demo.

### Profile is data, not auth
- `/profile` is a reusable profile-management screen.
- Reusable profile fields are limited to email, first name, and last name.
- Profile data seeds future applications but does not continuously overwrite existing applications.

### Multi-application model
- Support multiple applications per signed-in user.
- Use one open draft per course for the Tuesday demo.

### Course catalog source of truth
- Use `src/data/courses.raw.json` plus `src/lib/courseCatalog.ts`.
- Preserve raw academic fields such as `subjectArea`, `coreSubjects`, and `recognitionOfPriorLearning`.

### Normalized catalog display
- Normalize visible course categories to `Business`, `Technology`, and `Health`.
- Normalize support labels to `CSP`, `FEE-HELP`, and `HECS-HELP`.
- Normalize fees to simple approximate figures.
- Normalize duration to year-based labels where possible.

## 2026-05-22

### Document storage and submission integrity
- Enforce upload quotas on `storage.objects` inserts (not only `application_documents`) so direct Storage API uploads cannot bypass limits.
- Require `application_documents` rows to reference an existing storage object before insert.
- Server submission checks use `application_document_is_ready()` (document row + storage object); file-name-only placeholders no longer satisfy submit.

## 2026-03-05

### Explicit document upload guardrails
- Keep the 5 MB per-file limit and add explicit remote upload quotas/rate controls.
- Enforce controls in frontend storage logic, `application_documents` triggers, and `storage.objects` triggers so client bypasses remain bounded.
- Current remote guardrails:
  - per-application file quota: 30
  - per-application total bytes: 100 MB
  - per-user upload rate limit: 20 uploads per 10 minutes

### Enforced CSP with report collection
- Keep `Content-Security-Policy` enforced in `vercel.json` (not report-only).
- Send CSP reports to `/api/csp-report` and log normalized violations for allowlist tuning.
- Drop synthetic `example-cdn.test` payloads so rollout checks do not pollute production logs.

## 2026-03-06

### Local auth TTL and bypass hardening
- Keep company-access and local-data-owner keys in expiring storage with a 24-hour TTL.
- Keep localhost bypass in expiring storage with a 4-hour TTL.
- Restrict bypass enablement to development on `localhost` and `127.0.0.1`.

### Safe post-sign-in redirects
- Sanitize callback redirects to internal absolute paths only.
- Treat missing or unsafe redirect values as `/`.

### Shared storage-mode orchestration
- `AuthContext` is the source of truth for storage mode selection (`local` vs `remote`).
- Application state should persist through `ApplicationStorageAdapter` instead of page-level branching.

### Unified validation source
- Step progression (`next incomplete step`) and submission checks should come from one shared validation schema.
- Keep step-only vs submission-only requirements as per-rule targets, not duplicated logic trees.

### Generated Supabase typing baseline
- Generate `src/lib/supabase.types.ts` from the database schema and use it in Supabase client code.
- Prefer typed rows over manual casts in remote application/document stores.

### Strategy-learning integration platform boundary
- Build the university integration platform in a separate repository/service from the current applicant app.
- Keep the existing `application-prototype` repository focused on applicant UX and form journey delivery.
- Use a decoupled system boundary with versioned contracts and APIs/events rather than shared database tables.

### Integration architecture shape
- Use a modular monolith inside the new integration repository for early delivery speed.
- Keep API and worker runtime surfaces independently deployable within that repository.
- Standardize adapter lifecycle to `prepare -> execute -> verify -> reconcile`.
- Keep API/import/file delivery baseline mandatory; treat portal RPA as optional fallback.

### Integration delivery and ownership model
- Keep CI/CD, environments, and release cadence independent between the applicant app and integration platform.
- Use contract compatibility checks to prevent cross-repo breaking changes.
- Keep ownership boundaries service-level so a dedicated team can adopt the integration platform without splitting the applicant app.

### Linear execution model for this initiative
- Track this initiative under `DIS-58` (Team `Disco_Chicken`, Project `Applications`).
- Execute baseline first: schema/contracts, orchestration, file export, audit/reconciliation, then workspace decisioning.
- Move cards as work progresses: `Backlog -> In Progress -> In Review -> Done`.

### Tuesday demo completion and dual-track execution
- Tuesday demo scope is considered complete as of 2026-03-06.
- Execute two active tracks in parallel:
  - integration platform MVP (`DIS-58` and children) in a separate repository/service
  - continued applicant-flow UX improvements in the existing `application-prototype` repo
- Treat demo completion as a baseline milestone, not a freeze on UX iteration.

## 2026-04-27

### Eligibility check is a distinct project stream
- The next build stream is an eligibility-check flow, not a full admissions processing system.
- Primary user objective is to learn eligible postgraduate programs from uploaded evidence.

### Required document set for eligibility evaluation
- Transcript is required.
- Certificate of completion is conditionally required when completion status is not clear in transcript evidence.
- CV is included in the core evidence set for eligibility matching.

### Explainable advisory outcomes
- Eligibility results are advisory and must return transparent reasons.
- Each program result should include status, reason codes, and missing requirements.
- Use explicit fallback status (`insufficient_data`) when extraction confidence is low or required evidence is missing.

### Documentation cadence as project control plane
- Markdown docs are the shared memory layer for agent continuity.
- Every scope/contract/policy change must be documented in the same PR as implementation.
- `docs/eligibility-check-roadmap.md` is the active scope and architecture ledger for this project stream.

### Stakeholder update notes
- Publish date-stamped stakeholder updates in `docs/stakeholder-updates/`.
- Format updates for easy paste into Notion/chat with: what shipped, what is next, feedback request, and see/play links.

## 2026-05-20

### Restore real Supabase Auth via magic-link
- Supersedes the 2026-03-01 decision to avoid OTP/magic-link. The Tuesday demo
  is long complete, and the localStorage-only email gate provided no
  server-verifiable identity — so `/api/parse-cv`, the document delivery proxy,
  and Supabase RLS had no real caller identity to enforce against.
- `/sign-in` now sends a Supabase magic-link (`signInWithOtp`). `AuthContext`
  tracks the live Supabase session via `getSession` + `onAuthStateChange`.
- The company email-domain gate still applies: enforced client-side against the
  session email and server-side by the `is_allowed_company_user()` RLS policy.
  A signed-in session whose email is outside the allowed domains is signed out.
- The localhost-only dev bypass is unchanged.
- Restoring auth does NOT by itself move applicant data off the client.
  `storageMode` deliberately stays `local` for now; activating remote (Supabase)
  draft persistence is a separate change that should follow a remote-store
  integration test.

### Public applicant auth via email OTP
- Supersedes the remaining company-domain gate in the 2026-05-20 magic-link
  decision. Applicant access is no longer Keypath-only.
- `/sign-in` now uses a unified Supabase email one-time-code flow for both
  sign up and sign in. The email template must use `{{ .Token }}` so users can
  verify the code in-app.
- Auth can be initiated from the header, from eligibility completion before the
  result is shown, and from apply actions before an application is started.
- Signed-in users use remote Supabase profile/application/document storage;
  anonymous users can still browse and keep pre-auth draft state locally.
- Applicant RLS now relies on `auth.uid()` ownership checks instead of
  `is_allowed_company_user()` or `allowed_email_domains`.

### Public applicant auth via email + password
- Supersedes the 2026-05-20 public email OTP decision.
- `/sign-in` now uses Sign in and Create account tabs with Supabase
  `signInWithPassword` and `signUp`.
- New accounts require email confirmation before first sign-in. Sign-up passes
  `emailRedirectTo` to `/auth/callback?redirect=…` so confirmed users return to
  the intended in-app path.
- Auth can still be initiated from the header, eligibility completion, and apply
  actions before an application is started.
- Signed-in users continue to use remote Supabase profile/application/document
  storage; anonymous users can browse and keep pre-auth draft state locally.
- Applicant RLS remains `auth.uid()` ownership checks; no schema migration required.
- Hosted Supabase must enable Confirm email, use a Confirm signup template with
  `{{ .ConfirmationURL }}`, and configure custom SMTP for reliable delivery.
- Accounts created under the OTP flow may not have passwords; those users should
  use Forgot password on the Sign in tab to set one.
- Password reset preserves redirect intent via `/sign-in?recovery=1&redirect=…`.

## 2026-05-23

### Transcript eligibility integration uses a separate service boundary
- Keep transcript eligibility evaluation service-owned behind an app proxy route instead of embedding rules directly in the applicant frontend.
- Add `api/evaluate-transcript-eligibility` as the contract boundary so the browser never calls the eligibility service endpoint directly.
- Preserve existing upload validation and file-policy checks before forwarding transcript payloads.

### Eligibility result contract adopts four advisory outcomes
- Use `eligible`, `conditionally_eligible`, `ineligible`, and `insufficient_data` for transcript eligibility outcomes.
- Persist transcript eligibility assessments alongside tertiary qualification records to support explainable review surfaces.
- On service unavailability or uncertain extraction, default to `insufficient_data` with explicit manual-review guidance instead of guessing.

## 2026-06-17

### Auth hardening lands in app code rather than a Supabase Pro upgrade (DIS-119, DIS-123)
- The hosted Supabase project stays on the free tier, so the native
  leaked-password protection (Pro-only) and the Security Advisor toggles are not
  used. Deliver the protection in app code instead.
- Leaked-password protection (DIS-119): check new passwords (sign-up, reset,
  profile change) against the Pwned Passwords range API using k-anonymity (only
  the 5-char SHA-1 prefix leaves the browser), proxied through
  `api/check-leaked-password.ts` to stay within the app CSP. The check fails
  open so a breach-check outage never blocks an auth action.
- MFA (DIS-123): ship a `/profile` TOTP enroll/verify/disable flow over
  `supabase.auth.mfa`. It works wherever the TOTP factor is enabled and shows a
  clear message where it isn't.
- These do not clear the `auth_leaked_password_protection` /
  `auth_insufficient_mfa_options` advisor lints (the advisor inspects the
  Supabase setting, not app code). Clearing the lints still requires the
  dashboard toggles on a Pro project — tracked in `backend-rollout.md`.

## 2026-06-20

### Conditional ("optional hard") submission requirements
- Certificate of Completion and English-proficiency proof are required only under
  conditions, not unconditionally. Enforce in **both** the client review and the
  `submit_application` RPC; never let one side gate without the other.
- Certificate of Completion: required only when a tertiary is `completed` but its
  transcript can't evidence completion. Persist the transcript signal
  (`tertiary_qualifications.transcript_confirms_completion`) since the in-memory
  eligibility assessment doesn't survive reloads.
- English proficiency: required only when the course needs it, it can't be inferred
  from an English-medium-country qualification, and there's no language test **or
  AHPRA registration**. An AHPRA registration (recognised from the free-text
  accreditation name) counts as proof — at the submit gate and on the eligibility
  card (`ENGLISH_OK_AHPRA`). No new UI field; inferred from the accreditation name.
- Shared rule source: `src/lib/eligibility/englishProficiencyEvidence.ts`. The SQL
  RPC duplicates the AHPRA regex + English-medium-country list — keep them in sync.

## 2026-07-01

### Program evidence review replaces applicant-facing eligibility verdicts
- Transcript parsing remains backed by `/api/evaluate-transcript-eligibility`, but
  applicant-facing UI frames the result as **program evidence review**. The service
  extracts evidence; the app maps generated course requirements to required fields,
  documents, and manual-review nudges.
- Course pre-check questions are generated from `CourseCatalogEntry.requirements`
  when present, with the legacy education/experience config only as fallback.
- English evidence is program-specific: language-test records capture overall and
  component scores, and a test satisfies English only when scores and document meet
  the selected program's accepted pathway. AHPRA satisfies English only when the
  registration is current (`Active`) and documented.
- The app persists `applications.english_proficiency_policy` so the submit RPC can
  enforce the selected program's English score/document/AHPRA rules without loading
  the frontend catalog.
- Fuzzy matching is advisory only in v1. Academic-threshold shortfalls can surface
  possible alternate evidence for manual review, but do not automatically pass the
  requirement.

## 2026-07-05

### Eligibility feedback is a hybrid document, not inline application JSON
- Applicant disputes of automated evidence results save as
  `application_documents` rows with `kind = eligibility_feedback` and file name
  `eligibility-feedback.json` (schema v1 in `eligibilityFeedbackDocument.ts`).
- Use `saveEligibilityFeedbackDocument` / `replaceStoredDocument` — same hybrid
  storage path as other uploads; do not add page-local persistence.
- Feedback rows are derived from displayed met/review program evidence rows in
  `SupportingEvidencePanel` → `EligibilityFeedbackForm` (per-row notes).
- **Hydration contract:** resolve the latest feedback document from the
  `application_documents` query via `findEligibilityFeedbackDocument` — not from
  `applications.eligibility_feedback_*` columns alone. Those FK columns exist for
  optional indexing but are not the load source of truth today.
- Analytics: client `eligibility_feedback_submitted` (evidence flow) plus record
  update `application_eligibility_feedback_saved` after state persist.

### Hydration gating uses static placeholders, not spinners or validation flash
- While `ApplicationContext.isHydrating` is true, form pages must not render real
  hero content, validation panels, or `FormActionBar` actions that reflect empty
  pre-hydration state.
- Pattern: `showActionBar={!isHydrating}` on step shells; swap body for a route-
  specific loading state component with **static gray blocks** (no pulse/spinner).
- Lazy route Suspense fallbacks for `/section2/qualifications`, `/review`, and other
  `/section1/*` / `/section2/*` routes reuse the same shell + loading state
  (`Section2QualificationsRouteFallback`, `ReviewRouteFallback`, `FormStepRouteFallback`)
  so code-split load and data hydration look identical.

### Review screen defers to evidence hub, not transcript verdict summary
- Remove applicant-facing transcript eligibility summary from `/review`; evidence
  review belongs on the Section 2 qualifications hub only.
- Section 1 review cards: one **Edit** inline with the card heading (`ReviewCard`).
- Section 2 review cards: prefer **item-level Edit** (tertiary, employment) or
  document-row Edit (CV); avoid duplicate card-level Edit where item edits suffice.
  Multi-record sections may still expose a hub-level Edit to `/section2/qualifications`.

## 2026-07-09

### Pathway-first course requirements IR (v2)
- Replace single-shot flat LLM parsing with a multi-stage pipeline
  (segment → classify → structure → validate → repair) producing
  `CourseRequirementsV2` (`global` + `pathways[]`).
- Flatten to legacy `RequirementInstance[]` with `pathwayBundleId` for the existing
  matcher; update `isMatcherUnsafe()` to validate per-pathway buckets so multi-pathway
  courses route to the matcher instead of `deterministicRules`.
- Gate parser output with a golden corpus (`tests/fixtures/course-requirements/`) and
  `npm run eligibility:parse-eval` in the eligibility-contract CI workflow.
- Consolidate requirement-kind extensibility in `requirementKindRegistry.ts` (prompt
  fragment, evidence source, evaluator dispatch).
- Continuous improvement: mine PostHog `eligibility_check_override` via
  `eligibility:dump-overrides`, promote to golden fixtures, human-review PRs — no
  auto-merge of override-suggested rules.

## 2026-07-15

### Eligibility assessment selects one entry pathway
- Evaluate every published entry pathway independently, then return global checks
  plus one selected pathway. A satisfied pathway wins; otherwise choose the closest
  pathway deterministically so mutually exclusive entry levels do not leak into the
  same applicant evidence list.
- Persist additive `selectedPathwayId` and `pathwayResults` assessment metadata so
  Section 2 renders and requests evidence for the same pathway the matcher assessed.
- A named completed-award pathway must match both its published qualification and
  provider when those constraints are present. A completed qualification from a
  different institution cannot satisfy that pathway.
- Model “completed bachelor degree or higher” as one qualification-level requirement
  with `completedRequired`, rather than separate completion and level cards.
- Treat percentage/WAM wording followed by “or equivalent GPA” as one academic
  threshold unless the source includes a numeric GPA threshold and scale.

## 2026-07-16

### Work-experience eligibility is advisory, course-specific evidence
- CV parsing owns editable employment-row drafting only. Assess selected-course work
  requirements in the separate authenticated `/api/evaluate-work-experience` route and persist
  a versioned, fingerprinted result keyed by requirement ID.
- `relevantTo` describes the field/type of work. Put explicit managerial, supervisory,
  professional, leadership, or people-management requirements in optional
  `qualifyingRoleCriteria`; do not create or infer a universal seniority ladder.
- Use deterministic calendar duration with overlap merging and min/max bounds for year-only
  dates. Do not weight part-time/FTE, and do not treat a title alone as definite role-level
  evidence.
- Automated outcomes are conditional signals, not admissions decisions. Failures and
  unmodelled qualifiers produce `needs_review`, never a negative or submission block.

### Employer confirmation is optional, role-linked evidence
- Allow one `employment_letter` document per employment role using shared upload, delivery,
  replacement, and cleanup paths. Request a signed letter on company letterhead confirming
  title, employment dates, and main responsibilities.
- Do not parse or automatically verify letters in this release. Letter presence may change the
  evidence card to “Employer confirmation supplied — admissions review required”, but never to
  university-verified or finally eligible.
- Keep work-experience results and letters out of `application_submission_missing_fields`; the
  existing transcript service contract and submit RPC remain unchanged.
