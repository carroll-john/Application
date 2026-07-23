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

### Reversible product brands

- Shared UI consumes semantic tokens and the active `BrandConfig`; route components must not define page-local brand palettes or logos.
- `VITE_APP_BRAND=uc` selects the University of Canberra profile and UC catalogue. Absence selects StudyNext, preserving the production default.
- The active brand is applied to the document before React renders to avoid an unthemed first frame.
- UC uses its official inline logo assets, Figtree for UI/body copy, STIX Two Text for display headings, and Dark Teal for normal-size white-text actions.
- The UC header follows the official site's two-level structure: a Hale Navy utility strip above a white primary navigation bar with the official UC logo, application context, relevant university links, and the existing account action. The compact mobile state retains the utility context, logo, and account action without horizontal overflow. The StudyNext header remains unchanged.
- Public UC browse, course-detail, and submitted surfaces use a compact version of the official site's footer hierarchy: a pale quick-links area followed by a Hale Navy identity and legal-information area with the reversed UC logo, public university details, legal links, demonstration label, and acknowledgement of Country. Application forms remain footer-free.
- UC uses square editorial and content surfaces. Interactive controls such as buttons, inputs, search fields, pills, badges, and progress indicators retain their rounded control geometry.
- UC course browse cards use deterministic, category-specific pools of official UC subject-area imagery through the checked-in same-origin proxy, the configured UC logo, concise summaries and compact metadata chips. Filtering must not reshuffle imagery, and the StudyNext card variant remains unchanged.
- The UC demo's pre-application CV review uses applicant-friendly experience groups backed by the internal occupation classification and counts overlapping dates once. Guidance beneath the groups is generated from the applicant's included role types and durations rather than restating the full generic policy. The full browse catalogue remains beneath the initial CV upload screen but is hidden while reviewing the CV, reviewing experience, and showing matched courses. The matched-course screen reuses the same experience-group, duration, direct-entry and Admissions-review language; its summary strip does not repeat a matched occupation title, and its duration comes from the corresponding reviewed experience group. The prototype's internal GPA mapping is not applicant-facing work-experience copy, and potential credit remains a separate decision. Course-match cards omit the short course summary beneath the title, rank entry guidance and credit potential as High, Medium or Low confidence, and keep the home-page catalogue summary unchanged. Their indicative credit copy uses 6 points for graduate certificates, 12 for graduate diplomas and 18 for longer awards, always subject to supporting evidence and faculty assessment. Expanding an experience group lets applicants include roles and review or correct the mapped occupation title, with its classification level and short mapping description shown for context; parser confidence remains hidden on the review screen. Tertiary, secondary, and professional qualifications extracted from the CV are shown as named rows. Contact-detail prefill is handled later in the application rather than in this review. This pattern does not apply to StudyNext or `/review`.
- Matched-course card CTAs shortlist courses until exactly three are selected. The third selection reveals one shared assessment prompt; sign-in precedes the transcript field. Completed results are embedded in the three selected cards as side-by-side original versus after-potential-credit duration and 2026 indicative tuition, followed by the formal UC review boundary. Before assessment, and for non-selected cards, the existing entry and credit-potential guidance remains visible.
- The UC application overview reuses the selected course's reviewed catalogue imagery and exposes course facts with meaningful icons. Its three application sections use person, qualification and review metaphors rather than decorative placeholders; the StudyNext overview remains unchanged.
- `VITE_DEMO_MODE=true` disables PostHog and support capture; Sentry error capture may remain enabled but replay sampling is forced to zero.
- Public course and submitted surfaces may include the compact brand footer. Application forms retain navigation ownership in `ApplicationShell` and do not use a site footer.

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
  matching qualification. On the first hydrated qualifications visit, show the standard
  program-evidence progress state while that evidence is rematched to the selected course; do not
  ask for the same transcript again just to perform this landing review.
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
