# Decisions

## 2026-03-01

### One real auth flow for the Tuesday demo
- Use one real Supabase magic-link auth flow.
- Restrict access to `@keypathedu.com.au` during dogfooding.
- Do not use a second inner applicant OTP/login flow.

### Profile is data, not auth
- `/profile` is a reusable profile-management screen.
- Reusable profile fields are limited to email, first name, and last name.
- Profile data seeds future applications but does not continuously overwrite existing applications.

### Multi-application model
- Support multiple applications per signed-in user.
- Use one open draft per course for the Tuesday demo.

### Course catalog source of truth
- Use `src/data/courses.raw.json` plus `src/lib/courseCatalog.ts`.
- Preserve raw academic fields such as `subjectArea`, `coreSubjects`, and `recognitionOfPriorLearning`.

### Normalized catalog display
- Normalize visible course categories to `Business`, `Technology`, and `Health`.
- Normalize support labels to `CSP`, `FEE-HELP`, and `HECS-HELP`.
- Normalize fees to simple approximate figures.
- Normalize duration to year-based labels where possible.
