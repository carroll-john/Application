# Memory: UI

## Prototype Fidelity

Follow the Figma Make prototype unless a newer documented decision overrides it.

## CTAs

- **Primary (yellow):** main forward action only.
- **Secondary (deep blue):** save, manage, add, section actions.
- **Tertiary (white/outline):** blue text and border.

## Form Navigation

- Belongs to form layout, not site footer.
- Use shared `FormActionBar` / `ApplicationShell` action bar pattern.
- `continueLabel`: "Save & Return to Review" when editing from review path.

## Shared Primitives (reuse before local wrappers)

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

## Key Files

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
