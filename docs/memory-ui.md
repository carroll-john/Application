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
| `Section2QualificationsPage` | Section 2 qualifications hub |
| `ReviewStepPage` | Review and submit step |

Import form/auth shells from `features/forms` and `features/auth`, not `components/*` re-exports.

## Mobile

Mobile UX matters as much as desktop. Validate meaningful UI changes at both sizes.

## Review UX

- Review must immediately reshow missing-fields state after user returns from edit with unresolved validation.

## Key Files

| File | Role |
|------|------|
| `src/features/forms/layout.tsx` | `ApplicationShell`, `FormSectionCard` |
| `src/features/forms/FormActionBar.tsx` | Step actions |
| `src/features/section1/Section1StepPage.tsx` | Section 1 step shell |
| `src/features/section2/Section2RecordPage.tsx` | Section 2 record shell |
| `src/features/review/ReviewStepPage.tsx` | Review step shell |
| `src/components/ui/*` | Primitives |
| `src/hooks/useReviewReturn.ts` | Review edit return paths |
