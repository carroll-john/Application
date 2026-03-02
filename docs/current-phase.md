# Current Phase

## Goal
Get the Tuesday demo flow stable around:
- course browsing from a seeded catalog
- course-specific eligibility
- one Keypath-domain email gate
- local profile persistence
- multiple open applications by course
- dashboard visibility for open and submitted applications

## Done
- The Keypath-domain access gate is working in preview and production.
- Keypath-only site access is working in preview and production.
- Raw course extract is the catalog source of truth.
- Intake, fee, support, duration, and visible category data are normalized.
- The app supports multiple applications per signed-in user with one open draft per course.

## Next 3 Tasks
1. Route-by-route QA of the multi-course browse -> eligibility -> email gate -> apply flow.
2. Tighten dashboard and overview wording so course/application status is unambiguous.
3. Decide whether real Supabase auth should return after the demo or stay out of the prototype.

## Known Risks
- Production and localhost can diverge if a stale Vite process or cached bundle is still active.
- The course extract is factual but not curated; some fields will still need later marketing polish.
- Playwright browser validation is not always reliable in this environment, so some UI checks still need manual browser confirmation.
