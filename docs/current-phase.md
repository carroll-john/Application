# Current Phase

## Goal
Get the Tuesday demo flow stable and defensible in hosted dogfooding:
- course browsing from a seeded catalog
- course-specific eligibility
- one Keypath-domain email gate with safe redirect handling
- auto-seeded local profile persistence in local-first mode
- multiple applications with one open draft per course
- dashboard visibility for open and submitted applications
- shared validation behavior for step progression and submission checks

## Done
- The Keypath-domain access gate is working in preview and production.
- Keypath-only site access is working in preview and production.
- Raw course extract is the catalog source of truth.
- Intake, fee, support, duration, and visible category data are normalized.
- The app supports multiple applications per signed-in user with one open draft per course.
- Auth storage keys now enforce TTL expiry, including the localhost bypass key.
- Redirect sanitization and localhost-only bypass constraints are covered by tests.
- Application persistence now runs through a shared storage adapter (`local`/`remote`) with focused ApplicationContext hooks.
- Step-completion and submission-readiness checks now come from one shared validation schema.
- CSP is enforced in production with report collection via `/api/csp-report`.

## Next 3 Tasks
1. Route-by-route hosted QA in incognito for browse -> eligibility -> sign-in -> apply -> review -> submit, including stale-auth TTL behavior.
2. Review CSP and Sentry telemetry after hosted runs; tune allowlists/filters only where needed.
3. Decide post-demo auth direction (restore Supabase session flow vs keep local-first longer) and document migration steps.

## Known Risks
- Production and localhost can diverge if a stale Vite process or cached bundle is still active.
- Local-first cache can mask backend behavior unless tests are run with clean browser storage/incognito.
- TTL-based local auth can expire during long idle demo sessions and surprise testers.
- The course extract is factual but not curated; some fields will still need later marketing polish.
- Playwright browser validation is not always reliable in this environment, so some UI checks still need manual browser confirmation.
