# AGENTS.md

## Before You Code

Load the domain memory file for your task (do not rely on stale bullets here):

| Task area | Read first |
|-----------|------------|
| Auth, sign-in, OTP, callback | [docs/memory-auth.md](docs/memory-auth.md) |
| Applications, course selection, validation, submit | [docs/memory-applications.md](docs/memory-applications.md) |
| Uploads, document storage, delivery proxy | [docs/memory-documents.md](docs/memory-documents.md) |
| UI primitives, forms, layout, CTAs | [docs/memory-ui.md](docs/memory-ui.md) |
| Tests, worktrees, CI, local dev ops | [docs/memory-agent-workflow.md](docs/memory-agent-workflow.md) |

Also read when relevant:
- [docs/project-memory.md](docs/project-memory.md) — cross-cutting contracts index
- [docs/current-phase.md](docs/current-phase.md) — active priorities
- [docs/decisions.md](docs/decisions.md) — dated ADR history
- [docs/backend-rollout.md](docs/backend-rollout.md) — Supabase, Vercel, migrations

## Task Workflow

- When the user says **`Start new Task`**, run `npm run start-task -- "<task name>"` before making changes.
- Keep work in the generated sibling worktree on branch `codex/<slug>`.
- When the user says **`Finish Task`**, run `npm run finish-task -- "<task name>"` from a different checkout.
- Do not bypass dirty-tree guards unless the user explicitly accepts `--allow-dirty`.

## Non-Negotiable Guardrails

1. Preserve Figma Make prototype fidelity unless a documented decision overrides it.
2. Use `AuthContext` and shared route gates — no page-local auth checks.
3. Route persistence through `ApplicationStorageAdapter` — pages must not branch local vs remote storage.
4. Use shared `FileUpload` + hybrid document storage — never store file names only.
5. Keep submission requirements separate from page-save requirements unless product says otherwise.
