# AGENTS.md

## Context Loading Order

Before changing code, load context in this order:

1. `TASK.md` in the current worktree, when present.
2. [docs/system-context.md](docs/system-context.md).
3. The relevant current domain contract:

| Task area | Read first |
| --- | --- |
| Auth, sign-in, password, callback | [docs/domains/auth.md](docs/domains/auth.md) |
| Applications, course selection, validation, submit | [docs/domains/applications.md](docs/domains/applications.md) |
| Uploads, document storage, delivery proxy | [docs/domains/documents.md](docs/domains/documents.md) |
| Document parsing | [docs/domains/document-parsing.md](docs/domains/document-parsing.md) |
| UI primitives, forms, layout, CTAs | [docs/domains/ui.md](docs/domains/ui.md) |
| Tests, worktrees, CI, local development | [docs/workflows/agent.md](docs/workflows/agent.md) |

4. Only the active decisions linked from that domain contract.
5. Operational runbooks only when the task needs deployment or environment work.

Do not use files under `docs/archive/` or `docs/reviews/` as current guidance.
Linear is the source of active priorities.

## Automatic Task Workflow

- For a prompt that clearly requests a code or documentation change, automatically
  run `npm run start-task -- "<task name>"` before editing unless already inside
  the task worktree. The user does not need to say "Start new Task."
- Questions, reviews, and read-only diagnostics do not create a worktree.
- Keep work in the generated sibling worktree on branch `codex/<slug>`.
- `TASK.md` is an ignored, worktree-local snapshot of the prompt or linked Linear
  issue. Update it when scope or acceptance criteria change.
- Keep the worktree for follow-up changes. Finalise it only after merge or explicit
  abandonment; the user does not need to say "Finish Task."
- Never bypass dirty-tree guards unless the user explicitly accepts `--allow-dirty`.

## Conflict Rule

- Code and executable tests establish current behaviour.
- `docs/system-context.md` establishes intended ownership and boundaries.
- Resolve mismatches explicitly in the same change. Do not silently treat either
  side as stale.

## Non-Negotiable Guardrails

1. Applications and applicant data require authentication; no anonymous drafts.
2. Use `AuthContext` and shared route gates; no page-local auth ownership.
3. Route persistence through `ApplicationStorageAdapter`; pages must not import
   persistence implementations or branch storage modes.
4. Use shared document upload/save/delivery systems; never store file names only.
5. The server is authoritative for submission; client validation is a UX mirror.
6. The Applications repository owns final eligibility rules; the eligibility
   service extracts evidence only.
7. Use the code-based design system in `src/index.css`, `src/components/ui/*`, and
   shared product primitives. Do not use external design-file instructions or
   page-local brand tokens.
8. A duplicated business rule must be declared as an intentional mirror in
   `docs/system-context.md` and protected by generation or a contract test.

## Azure Boards Linking

This repo mirrors to Azure Repos (`carrolljohn` org, `Application` project) on every push. When working a story from the Azure Boards backlog, include `AB#<work-item-id>` in the commit message or PR title/description (e.g. `Add transcript parser endpoint AB#20`). This auto-links the commit/PR to the corresponding work item on the board. Current backlog IDs run AB#11–AB#25 — check the board for the live mapping.
