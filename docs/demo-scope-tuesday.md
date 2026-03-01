# Tuesday Demo Scope

## In Scope
- Browse a real range of seeded courses.
- Open a course detail page for each course.
- Run a course-specific eligibility check.
- Sign in with a Keypath email via the real Supabase auth flow.
- Automatically create a reusable profile if one does not already exist.
- Start or resume one open application per course.
- See all open and submitted applications for the signed-in user.

## Out Of Scope
- Admin tooling
- Provider/course form configuration UI
- Public non-Keypath sign-up
- Multiple profiles per user
- Deep CMS or marketing polish

## Acceptance Checklist
- A signed-out user can browse the course catalog and course details.
- An unauthenticated user who tries to apply is sent to `/sign-in`.
- After sign-in, the user returns to the intended course/application flow.
- If no profile exists, one is created automatically.
- If an open application already exists for the selected course, it is resumed.
- If no open application exists for the selected course, a new one is created.
- Dashboard shows multiple applications across different courses.
- Review and submission still work with the current validation rules.
