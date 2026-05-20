# Multi-Program Flow Options

## Purpose
This note captures discovery for `DIS-15`: how to support one profile/form pass for multiple intended course applications without destabilizing the current Applications UX flow.

## Current Baseline
- The current product rule is one open draft per course.
- Each application stores exactly one selected course in `applicationMeta.selectedCourse`.
- The frontend keeps one active application loaded at a time via `activeApplicationId`.
- Eligibility is evaluated from the course detail page against the selected course's rules before application start.
- Starting a second course already works today through prefill/clone behavior, but it is explicit and course-by-course rather than a first-class multi-program flow.

## Current Constraints
### Product constraints
- Eligibility is course-specific. A user can be eligible for one course and ineligible for another.
- Section 2 requirements can vary by selected course, so "complete once for everything" is not fully true.
- Submission is currently per application, not per bundle.
- Dashboard, overview, review, analytics, and submission all assume a single selected course per application.

### Technical constraints
- `CourseDetails.tsx` starts or resumes one course application at a time.
- `useApplicationStorageOrchestration.ts` reopens an existing draft for the selected course or creates one new draft for that course.
- `applicationRecords.ts` summarizes and sorts applications at the individual draft level.
- `ApplicationContext` exposes one active application state object, not a multi-course workspace.
- Remote submission and analytics are keyed to a single course/application record.

## Options
### Option 1: True single multi-course application record
- Model one application record with multiple intended courses attached.
- Run one shared form journey, then derive course-specific requirements inside that single record.
- Pros:
  - Cleanest "one form pass" story for the user.
  - One container for shared answers and multi-course intent.
- Cons:
  - High-risk mismatch with the current architecture.
  - Breaks the single-course assumption across overview, review, dashboard, analytics, and submission.
  - Complicates eligibility because each course can branch differently.
  - Requires a new submission model, not just a UX change.
- Assessment:
  - Not recommended for the current codebase or rollout stage.

### Option 2: Linked application set with separate per-course drafts
- Let the user choose multiple intended courses, but create one draft per course behind the scenes.
- Keep `applicationMeta.selectedCourse` singular on each draft.
- Add optional grouping metadata later, such as `applicationSetId`, `intentRank`, or `sourceApplicationId`.
- Use one shared data snapshot to seed sibling drafts, then let each draft diverge where course-specific rules apply.
- Pros:
  - Fits the existing one-open-draft-per-course rule.
  - Reuses the current clone/prefill path instead of replacing it.
  - Keeps review, submission, analytics, and resume logic course-specific.
  - Allows phased rollout with low migration risk.
- Cons:
  - The user still ends up with multiple drafts, so the UX must explain that clearly.
  - Shared edits after fan-out need a defined sync policy.
- Assessment:
  - Recommended.

### Option 3: Multi-course shortlist only
- Let users save multiple intended courses first, but still begin one application at a time.
- No shared draft creation until the user explicitly starts a second course.
- Pros:
  - Lowest engineering risk.
  - Useful as a planning aid on dashboard and browse surfaces.
- Cons:
  - Does not materially deliver the "one form pass" promise.
  - Leaves the real duplication problem mostly unchanged.
- Assessment:
  - Good precursor step, but not enough as the end state.

## Recommended Direction
Adopt Option 2: linked sibling drafts, not a single multi-course application record.

This keeps the current stable contract intact:
- one selected course per application
- one active application in context at a time
- one eligibility result per course
- one submission per course

The multi-program behavior should be orchestration:
- gather intended courses
- complete shared profile/core details once
- create sibling drafts for each selected course from that shared snapshot
- route the user into the next course-specific gap or review state per draft

## Eligibility And Workflow Impact
### Eligibility
- Eligibility should remain per course.
- A multi-course chooser can preflight each course independently, but one failed course must not block eligible siblings.
- The UI should show per-course status: `Eligible`, `Needs different evidence`, or `Not eligible`.

### Shared data
- Safe to reuse:
  - profile fields
  - personal details
  - contact details
  - most qualifications and employment history
  - reusable supporting documents where policy allows
- Must remain course-aware:
  - eligibility outcome
  - selected course metadata
  - course-specific requirement messaging
  - final submission state

### Resume behavior
- Resume should still land in one draft at a time.
- Dashboard should group linked drafts visually, but opening one should preserve the current single-active-application model.

## Proposed Rollout
### Phase 1: Shortlist and intent capture
- Add an "Apply to more than one course" affordance from browse/dashboard.
- Let users pick up to a small capped number of intended courses, for example 2 or 3.
- Do not change the application record model yet.
- Outcome:
  - validates demand and ordering preferences with low risk.

### Phase 2: Fan-out from a shared snapshot
- After the first eligible application reaches Overview or Review, offer "Use these details for another course".
- Reuse the existing clone path to create sibling drafts for selected courses.
- Land each new sibling on Review or the next incomplete step, depending on what is course-specific.
- Outcome:
  - delivers the real time-saving benefit with minimal architectural churn.

### Phase 3: Linked application-set metadata
- Add lightweight grouping metadata:
  - `applicationSetId`
  - `intentRank`
  - `sourceApplicationId`
- Group linked drafts on dashboard and in analytics.
- Keep each draft independently submittable.

### Phase 4: Per-course gap guidance
- Show a grouped view of linked drafts with course-by-course missing items, eligibility status, and next action.
- Avoid batch submit unless product explicitly wants it later.

## Dependencies
- Product decision on maximum number of intended courses allowed in one set.
- Product decision on whether course priority/order matters.
- Product decision on whether ineligible courses remain in the set or are removed.
- UX design for grouped dashboard cards and course-by-course status presentation.
- Clear sync rules after sibling drafts are created.
- Analytics events for set creation, sibling draft creation, and grouped continuation.
- If grouping metadata is persisted remotely, a backend-safe extension to draft storage and summary queries.

## Risks
- Users may assume all linked drafts stay in sync forever. They should not.
- Course-specific requirements can create confusion if the initial "shared pass" message overpromises.
- Document reuse needs careful handling so linked drafts do not accidentally share mutable file handles.
- A grouped UX can obscure the fact that submission is still per course.
- Local-first storage can make linked-draft state harder to reason about unless grouping metadata is explicit.

## Recommendation Summary
- Do not build a single multi-course application record.
- Build multi-program support on top of the current per-course draft model.
- Start with shortlist capture, then fan out linked sibling drafts from a shared snapshot.
- Keep eligibility, review, and submission course-specific throughout rollout.
