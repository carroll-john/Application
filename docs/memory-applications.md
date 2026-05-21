# Memory: Applications

## Model

- Multiple applications per signed-in user.
- One open draft per course; submitted applications kept separately.
- Selected course stored in `applicationMeta.selectedCourse` — never implicit/hard-coded.
- Eligibility is course-specific; no direct apply shortcut bypassing eligibility on course pages.

## State Layer

- `ApplicationContext` — shared application state (facade over hooks in `src/context/application/` or `src/features/application/`).
- `AuthContext` selects `storageMode` (`local` vs `remote`).
- `ApplicationStorageAdapter` — single persistence contract; pages must not branch local vs remote.
- Types and merge helpers: `src/lib/applicationData.ts`.

## Validation

- Single schema: `src/lib/applicationValidationSchema.ts` for step completion and submission readiness.
- Section 2 submission rule: at least one tertiary qualification **or** both CV and employment experience.
- Tertiary documents are submission-gated, not save-gated.
- Course-specific Section 2 overlay: `src/lib/section2Requirements.ts`.

## Submission

- Server-backed submit via `submit_application` RPC (`0002_server_submit.sql`, `0004_submission_rpc_grants.sql`).
- Do not move application-number generation back to client-only code.

## Course Catalog

- Source: `src/data/courses.raw.json` → `src/lib/courseCatalog.ts`.
- Preserve raw academic fields; normalize display labels per `project-memory.md`.

## Key Files

| File | Role |
|------|------|
| `src/context/ApplicationContext.tsx` | Provider facade |
| `src/context/application/useApplicationData.ts` | CRUD mutators |
| `src/context/application/useApplicationStorageOrchestration.ts` | Hydration, begin app, submit |
| `src/lib/applicationStorageAdapter.ts` | Storage contract |
| `src/lib/applicationRecords.ts` | Local record helpers |
| `src/lib/applicationRemoteStore.ts` | Supabase persistence |
| `src/pages/ReviewAndSubmit.tsx` | Review + submit |

## Agent Module Boundary

Owns: context hooks, orchestration, adapter calls, validation schema consumers.
Coordinate before changing: Supabase RLS migrations, `api/*` routes.
