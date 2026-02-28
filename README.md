# Application Prototype

University application prototype built with React, Vite, TypeScript, Tailwind, and Supabase.

## Repo Structure

- `src/`
  - `components/` shared UI and layout primitives
  - `context/` auth and application state providers
  - `hooks/` small shared hooks
  - `lib/` business logic, validation, persistence, and backend helpers
  - `pages/` route-level screens
- `docs/`
  - `project-memory.md` durable product and implementation decisions
  - `backend-rollout.md` Supabase and deployment setup
- `supabase/`
  - `migrations/` SQL migrations
  - `reset_test_data.sql` clean hosted test reset

## Core Commands

```bash
npm install
npm run dev
npm test
npm run build
```

## Notes

- Read `docs/project-memory.md` before making product or UX changes.
- The app is currently dogfooded behind a Keypath-only site gate.
- Localhost has a dev-only auth bypass for post-auth verification.
