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
| `SectionProgressHeader` | Step progress |
| `ModalShell` | Modals (e.g. auth) |

## Mobile

Mobile UX matters as much as desktop. Validate meaningful UI changes at both sizes.

## Review UX

- Review must immediately reshow missing-fields state after user returns from edit with unresolved validation.

## Key Files

| File | Role |
|------|------|
| `src/components/ApplicationShell.tsx` | Wizard shell |
| `src/components/FormActionBar.tsx` | Step actions |
| `src/components/ui/*` | Primitives |
| `src/hooks/useReviewReturn.ts` | Review edit return paths |
