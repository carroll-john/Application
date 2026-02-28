# AGENTS.md

## Project Memory
- Before making product, UX, or interaction changes, read [docs/project-memory.md](/Users/jc/Documents/New%20project/docs/project-memory.md).
- Treat that file as the durable memory for design decisions, shared component contracts, integrations, and known risks.

## Working Expectations
- Preserve fidelity to the Figma Make prototype unless a newer documented decision overrides it.
- Prefer fixing shared primitives and layout systems over page-by-page patches when the same issue appears across routes.
- Prefer extending existing shared UI primitives before introducing page-local styling or new small wrapper components.
- Validate meaningful UI changes in the running app at both desktop and mobile sizes.
- Form navigation belongs to the form layout, not the site footer. Use the shared action-bar pattern.
- Keep routing and provider layers thin. Prefer inline route redirects and shared application state over one-off wrapper components when they do not add real behavior.
- The repo now has a real auth scaffold. Use `AuthContext`, Supabase config, and protected routes instead of inventing page-local auth checks.
- Company-only access is enforced at the sign-in form, the session gate, and the Supabase RLS layer. Do not rely on a single client-only domain check.
- Keep that company-domain gate on the whole site during the current dogfood phase. Do not narrow it to admin-only routes until launch preparation explicitly calls for it.
- Treat business-user access and applicant identity as separate concerns. Use the `business_users` and `applicant_profiles` groundwork rather than assuming the signed-in Keypath employee is the long-term applicant auth model.
- The current internal flow now includes a separate applicant-profile step before the deeper application journey. Preserve that separation instead of letting applicant-profile seed data accidentally mark Section 1 as complete.
- A localhost-only auth bypass now exists for temporary verification beyond the Keypath gate. Keep it strictly local/dev-only and never let it leak into preview or production behavior.
- Treat the app as a single persisted application unless and until a real multi-application data model is added. Do not reintroduce mock dashboard inventories or fake copy-from-application flows.
- `ApplicationContext` is now a hybrid draft layer: local cache plus authenticated Supabase draft sync. Do not regress it back to browser-only persistence, and do not bypass the shared remote store when adding backend work.
- For dashboard, overview, and other summary surfaces, prefer the shared `AppBrandHeader`, `SurfaceCard`, and `StatusPill` primitives over one-off wrappers.
- Avoid unnecessary customization. If a button, badge, card, or accent treatment already exists in shared UI, reuse it instead of rebuilding it locally.
- For document flows, use the shared `FileUpload` component and the IndexedDB-backed document storage pattern in `src/lib/documentStorage.ts` rather than storing file names only.
- `src/lib/documentStorage.ts` is now hybrid. Preserve the remote-capable upload path for authenticated Supabase sessions and the local fallback for development; do not collapse it back to name-only metadata.
- For backend work, keep `docs/backend-rollout.md` and the Supabase migrations aligned. Do not add ad hoc backend assumptions that drift from those files.
- Server-backed final submission now depends on `supabase/migrations/0002_server_submit.sql` and the `submit_application` RPC. Do not move application-number generation back into client-only code.
- The app is now linked to Vercel and live at `https://application-prototype.vercel.app`. Keep Supabase Auth redirect URLs aligned with that deployed domain whenever auth/deployment settings change.
- When preparing a clean hosted test cycle, use `supabase/reset_test_data.sql` for the database and a private/incognito browser session for the app so local cached draft data does not mask backend behavior.
- Shared application types and local-cache helpers now live in `src/lib/applicationData.ts`. Reuse them instead of redefining the application shape in backend-facing code.
- Keep file-picker interactions as native as possible. Prefer the current label-linked native file input pattern in `FileUpload` over hidden-input click proxies, transparent overlays, or overly customized direct file-input styling.
- Keep upload actions minimal and consistent: prefer `add`, `view`, and `remove`. Do not add one-off download or duplicate helper controls unless the product really needs them.
- If localhost behavior and source disagree after upload-control changes, restart Vite and test in a fresh browser tab before refactoring again.
- If auth or upload behavior looks wrong locally, check for a stale Vite process and confirm you are on the intended localhost port before changing implementation code.
- If upload behavior regresses unexpectedly, first check for a stale Vite process still holding `5173`, then restart the dev server cleanly and retest in a fresh browser tab before changing the uploader again.
- Treat submission requirements separately from page-save requirements unless the product explicitly says otherwise. Tertiary supporting documents and the broader Section 2 rule are submission-gated, not progression-gated.
- When cleaning up, remove dead state and obsolete prototype-era UI behavior rather than carrying it forward. Recent examples include fake save delays, dead form fields, and unused upload actions.
