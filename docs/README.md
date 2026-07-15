# Documentation

This index is the human entry point for project documentation. Coding agents
start at [`../AGENTS.md`](../AGENTS.md); both paths lead to the same system and
domain context.

## Current context

| Document | Purpose |
| --- | --- |
| [`system-context.md`](system-context.md) | Authoritative runtime topology, ownership, boundaries, and intentional mirrors. |
| [`domains/auth.md`](domains/auth.md) | Auth, session, recovery, and route-gate contract. |
| [`domains/applications.md`](domains/applications.md) | Application state, validation, persistence, eligibility rules, and submission. |
| [`domains/documents.md`](domains/documents.md) | Upload, storage, replacement, delivery, and cleanup. |
| [`domains/document-parsing.md`](domains/document-parsing.md) | Shared parser framework plus the documented transcript exception. |
| [`domains/ui.md`](domains/ui.md) | Code-based design system, forms, layouts, and shared primitives. |

## Decisions and execution

| Location | Purpose |
| --- | --- |
| [`decisions/`](decisions/) | Curated active architectural decisions and their rationale. |
| [`workflows/agent.md`](workflows/agent.md) | Agent task lifecycle, working sets, and verification map. |
| [`workflows/ci.md`](workflows/ci.md) | Continuous-integration behaviour. |
| [`runbooks/backend.md`](runbooks/backend.md) | Supabase, Vercel, migrations, environments, and service operations. |
| [`runbooks/auth-password.md`](runbooks/auth-password.md) | Applicant password-auth troubleshooting. |

## Reference material

- [`contracts/`](contracts/) contains caller-side compatibility snapshots. The
  external provider owns the published service contract.
- [`reviews/`](reviews/) contains dated historical assessments, not current guidance.
- [`archive/`](archive/) contains superseded plans and logs, not current guidance.
- Analytics, security, product explorations, and stakeholder notes remain
  discoverable under `docs/` but do not override system or domain context.

Active priorities live in Linear. Each coding worktree carries an ignored
`TASK.md` snapshot so agents do not depend on a manually maintained phase file.
