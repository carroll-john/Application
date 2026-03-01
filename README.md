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
npm run start-task -- "Fix auth redirect"
npm run finish-task -- "Fix auth redirect"
```


## Start New Task

Use the task bootstrap whenever you want a fresh Codex workstream for an unrelated change.

```bash
npm run start-task -- "Fix auth redirect"
```

That command:

- creates a new `codex/<slug>` branch
- creates a sibling worktree next to the repo, for example `/Users/jc/Documents/new-project-fix-auth-redirect`
- prints the new path so the next Codex thread can stay isolated there

By default the helper refuses to run if the current checkout is dirty, which prevents unrelated in-progress edits from leaking into the new task. If you intentionally want to branch from the current committed `HEAD` while leaving local changes behind in the existing checkout, use:

```bash
npm run start-task -- --allow-dirty "Spike onboarding copy"
```

## Finish Task

Use the cleanup helper after the task branch has been merged or when you want to discard the task worktree.

```bash
npm run finish-task -- "Fix auth redirect"
```

The helper resolves either the original task name, the full branch name, or the worktree path. It removes the sibling worktree first and then deletes the `codex/<slug>` branch with Git's safe delete behavior.

Run it from the main checkout or another worktree, not from inside the task worktree you are trying to remove.

If you need to clean up an unmerged branch or a worktree with local changes, use:

```bash
npm run finish-task -- --force "Spike onboarding copy"
```

If you want to remove only the worktree and keep the branch around:

```bash
npm run finish-task -- --keep-branch "Spike onboarding copy"
```

## Notes

- Read `docs/project-memory.md` before making product or UX changes.
- The app is currently dogfooded behind a Keypath-only site gate.
- Localhost has a dev-only auth bypass for post-auth verification.
