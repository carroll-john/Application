---
schema_version: 1
document_type: domain_contract
domain: ui
status: active
owner: src/components/ui
---

# UI Domain

## Owner

The code-based design system is authoritative:

- `src/index.css` owns brand, semantic, radius, shadow, and typography tokens.
- `src/components/ui/*` owns base controls.
- shared product primitives such as `AppBrandHeader`, `SurfaceCard`,
  `AccentIconBadge`, `FileUpload`, and form shells own recurring compositions.

External design files are not a project source of truth.

## Current contract

### Catalogue contexts and visual brand

- Shared UI consumes semantic StudyNext tokens and shared primitives; route components must not define page-local brand palettes or logos.
- `VITE_APP_BRAND=uc` selects the University of Canberra catalogue and prototype-only UC assessment flows. Absence selects the default StudyNext catalogue.
- Both catalogue contexts use the StudyNext Apply visual system. The catalogue selection and active visual theme are recorded separately on the document before React renders.
- StudyNext Apply uses the StudyNext wordmark with an `Apply` service label, Montserrat across UI and display copy, navy/mint/yellow tokens, pill controls, and large-radius light surfaces.
- Provider names, course data, policy copy, support details, and UC-specific assessment behavior remain contextual content. They must not reactivate partner-specific logos, typography, colour overrides, site navigation, footers, square panels, or course-card anatomy.
- Course discovery uses the StudyNext marketing-header variant and a full-width photographic search hero. The generated hero asset is repository-owned; navigation, search, filters, topic shortcuts, and course content remain code-native. Public application, sign-in, overview, dashboard, and form surfaces continue to use the compact StudyNext Apply header. Application forms retain navigation ownership in `ApplicationShell`; application surfaces do not use the StudyNext marketing footer.
- Browse catalogue cards use the shared image-first StudyNext card anatomy: stable media crop, provider/title hierarchy, mint directional mark, concise provider summary, and compact study-fact pills. Matched-course cards reuse the provider/title and fact treatment without catalogue media or summary so entry and credit guidance remain primary.
- The invitation-only treatment journey lives at `/assessment`; control participants continue through the ordinary 33-course catalogue. Its CV review uses applicant-friendly experience groups and advisory course ranking. CV/OSCA evidence never produces credit points.
- Matched-course CTAs shortlist exactly three courses. Sign-in precedes transcript upload. Completed cards show “Up to X credit points”, published cap, confidence, mapped transcript evidence, manual-review reasons, and mandatory UC confirmation. They do not show course-length, duration, tuition, savings, identity-specific, or zero-credit claims. `null` is rendered as UC manual review.
- `/staff/reviews` is a sensitive authenticated surface. It shows the queue only after TOTP raises the session to AAL2, keeps private notes out of analytics, and exposes only the workflow actions allowed by the server. Reviewers cannot edit applicant evidence or issue a formal admission/credit decision.
- Application overviews share the StudyNext layout and component styling across catalogue contexts.
- `VITE_DEMO_MODE=true` disables PostHog and support capture; Sentry error capture may remain enabled but replay sampling is forced to zero.
- Application surfaces remain footer-free.

Extend tokens and shared primitives before introducing a new page-local visual
pattern. Existing hard-coded exceptions may be migrated incrementally; new code
must not expand them.

## CTAs

- **Primary (yellow):** main forward action only.
- **Secondary (deep blue):** save, manage, add, section actions.
- **Tertiary (white/outline):** blue text and border.

## Form Navigation

- Belongs to form layout, not site footer.
- Use shared `FormActionBar` / `ApplicationShell` action bar pattern.
- `continueLabel`: "Save & Return to Review" when editing from review path.

## Approved entry points

### Shared primitives (reuse before local wrappers)

| Primitive | Use for |
|-----------|---------|
| `AppBrandHeader` | Branded top bars on browse, overview, dashboard |
| `SurfaceCard` | Card surfaces |
| `StatusPill` | Status badges |
| `AccentIconBadge` | Icon badges |
| `FileUpload` | Document uploads |
| `FormActionBar` | Step navigation |
| `ApplicationShell` | Section 1/2 wizard layout |
| `ModalShell` | Modals (e.g. auth) |

## Step Wrappers

Use feature step shells instead of page-local layout:

| Wrapper | Use for |
|---------|---------|
| `Section1StepPage` | Section 1 wizard steps |
| `Section2RecordPage` | Section 2 add/edit record flows |
| `Section2SaveProgressPanel` | Optional in-save progress during async Section 2 save (e.g. CV parse) |
| `Section2QualificationsPage` | Section 2 qualifications hub |
| `ReviewStepPage` | Review and submit step |

Import form/auth shells from `features/forms` and `features/auth`, not `components/*` re-exports.

## Hydration placeholders

While `useApplication().isHydrating` is true, do not flash empty heroes, validation
errors, or enabled action bars. Gate on `!isHydrating` before showing real content.

| Concern | Pattern |
|---------|---------|
| Action bar | `showActionBar={!isHydrating}` on `ApplicationShell` / `ReviewStepPage` / `Section2QualificationsPage` |
| Body | Route-specific `*LoadingState` with static gray blocks — **no pulse, no spinner** |
| Validation / ready banners | Compute only when `!isHydrating` (e.g. review `readyToSubmit`, `showValidationErrors`) |
| Lazy Suspense | Path-specific fallbacks in `routes.tsx` `RouteLoadingScreen` match the hydration shell |

| Component | Route / use |
|-----------|-------------|
| `Section2QualificationsLoadingState` | Section 2 hub body while hydrating |
| `Section2QualificationsRouteFallback` | Suspense fallback for `/section2/qualifications` |
| `ReviewLoadingState` | Review body while hydrating |
| `ReviewRouteFallback` | Suspense fallback for `/review` |
| `FormStepLoadingState` | Section 1 + Section 2 record page bodies while hydrating |
| `FormStepRouteFallback` | Suspense fallback for `/section1/*` and other `/section2/*` routes |

**Shell wiring:** `Section1StepPage` and `Section2RecordPage` gate children on
`isHydrating` — all 13 form step pages inherit the pattern without per-page edits.
See [PR #202](https://github.com/carroll-john/Application/pull/202).

## Section 2 evidence hub

- `SupportingEvidencePanel` — program evidence cards + feedback entry point.
- During an automatic transcript evidence review, the results panel remains hidden while the
  dedicated progress panel is visible. Once processing completes, result cards reveal in reading
  order; reduced-motion users receive the completed result immediately without staggered delays.
- A UC application started after the pre-application transcript comparison arrives with blank
  qualification fields prefilled from the extracted evidence and the transcript attached to the
  matching qualification. It excludes other qualification suggestions from the incoming CV while
  preserving unrelated saved or user-added qualifications. On the first hydrated qualifications visit, show the standard
  program-evidence progress state while that evidence is rematched to the selected course; do not
  ask for the same transcript again just to perform this landing review, or request English evidence
  when the transcript assessment already marks English language proficiency as met.
- Extracted WAM/GPA is not listed as standalone eligibility evidence. It appears only in the
  result copy for a published academic-threshold requirement; courses without a threshold omit it.
- `EligibilityFeedbackForm` — per-row dispute notes; CTA copy in `uiCopy.ts`
  (`Save feedback` / `Saving...`).
- Feedback rows mirror met/review evidence rows from `buildProgramEvidenceRows`.

## Section 2 async save

- Standard record pages: `useSection2RecordSave` + inline `saveRecord` (errors via `StatusMessage` on the page shell).
- Parse-enabled pages (CV today): `useSection2DocumentSaveWithParse` + kind policy; blocking upload errors on-page, parse failures as qualifications-hub flash (`section2StatusMessage`).
- Document fields: `DocumentUploadField` or extracted wrappers (`CvUploadFields`, `TertiaryDocumentFields`) — not page-local `FileUpload` wiring.

## Mobile

Mobile UX matters as much as desktop. Validate meaningful UI changes at both sizes.

## Review UX

- Review must immediately reshow missing-fields state after user returns from edit with unresolved validation.
- No transcript eligibility summary on `/review` — evidence review lives on the Section 2 hub only.
- **Section 1:** `ReviewCard` Edit inline with the card heading.
- **Section 2:** item-level Edit on list rows (tertiary, employment); CV Edit on
  `ReviewDocumentRow`; some multi-record cards still link to the qualifications hub.

## Key files

| File | Role |
|------|------|
| `src/features/forms/layout.tsx` | `ApplicationShell`, `FormSectionCard` |
| `src/features/forms/FormActionBar.tsx` | Step actions |
| `src/features/section1/Section1StepPage.tsx` | Section 1 step shell |
| `src/features/section2/Section2RecordPage.tsx` | Section 2 record shell |
| `src/features/section2/Section2QualificationsLoadingState.tsx` | Hub hydration placeholder |
| `src/features/section2/Section2QualificationsRouteFallback.tsx` | Hub Suspense fallback |
| `src/features/section2/SupportingEvidencePanel.tsx` | Evidence cards + feedback |
| `src/features/section2/EligibilityFeedbackForm.tsx` | Per-row feedback form |
| `src/features/review/ReviewStepPage.tsx` | Review step shell |
| `src/features/review/ReviewLoadingState.tsx` | Review hydration placeholder |
| `src/features/review/ReviewRouteFallback.tsx` | Review Suspense fallback |
| `src/features/review/ReviewSections.tsx` | `ReviewCard`, `ReviewList`, `ReviewDocumentRow` |
| `src/routes.tsx` | `RouteLoadingScreen` path-specific fallbacks |
| `src/components/ui/*` | Primitives |
| `src/hooks/useReviewReturn.ts` | Review edit return paths |

## Forbidden shortcuts

- External design-file implementation instructions or fidelity checks.
- New page-local brand colours, radii, shadows, base controls, or CTA systems.
- Page-local form/navigation shells when a shared step wrapper exists.
- Direct `FileUpload` wiring when `DocumentUploadField` or an extracted wrapper applies.

## Intentional mirrors

- Suspense fallbacks mirror hydration placeholders so route loading and hydrated
  loading have the same geometry. Shared shells and route tests protect this.
- Responsive variants intentionally mirror the same interaction across desktop
  and mobile; validate both sizes rather than creating separate flows.

## Required checks

- Run relevant component and route tests.
- Run `npm run build` for type and production-bundle validation.
- Validate meaningful UI changes at desktop and mobile sizes.
- Confirm new visual values extend the design-system owners rather than appearing
  only in a page or feature.

## Related decisions

- [ADR-0005: Code-Based Design System](../decisions/0005-code-based-design-system.md)
- [ADR-0006: Repository Context Control Plane](../decisions/0006-context-control-plane.md)
- [ADR-0008: Assessment Sessions and AAL2 Staff Review](../decisions/0008-assessment-sessions-and-aal2-review.md)
