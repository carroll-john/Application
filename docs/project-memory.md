# Project Memory

## Purpose

Durable product, UX, and implementation contracts. For task-specific detail, load the domain memory files below instead of duplicating rules here.

## Domain Memory (load by task)

| File | Scope |
|------|--------|
| [memory-auth.md](memory-auth.md) | Password auth, session, redirects, profile |
| [memory-applications.md](memory-applications.md) | Multi-app model, validation, submit, course catalog |
| [memory-documents.md](memory-documents.md) | Uploads, hybrid storage, delivery proxy |
| [memory-ui.md](memory-ui.md) | Primitives, CTAs, form navigation |
| [memory-agent-workflow.md](memory-agent-workflow.md) | Tests, module boundaries, local dev |

## Phase and History

| File | Scope |
|------|--------|
| [current-phase.md](current-phase.md) | Active priorities and tracks |
| [decisions.md](decisions.md) | Dated ADR-style decisions (append-only) |
| [demo-scope-tuesday.md](demo-scope-tuesday.md) | **Historical** Tuesday demo scope |
| [backend-rollout.md](backend-rollout.md) | Supabase, Vercel, migrations, env |
| [auth-password-troubleshooting.md](auth-password-troubleshooting.md) | Password auth ops runbook |

## Documentation Rhythm

- Update the relevant `.md` in the same PR when scope, contracts, or priorities change.
- If code and docs disagree, treat docs as stale and fix them in the same branch.
- For eligibility backend work, see [eligibility-check-roadmap.md](eligibility-check-roadmap.md).
- For integration platform (separate repo), see [integration-platform-mvp.md](integration-platform-mvp.md).

## Cross-Cutting Contracts

- Follow Figma Make prototype unless a documented decision overrides it.
- Submission requirements and page-save requirements are separate.
- `applicationData.ts` types and `ApplicationStorageAdapter` interface are stable contracts — extend, do not fork.
- Integration platform runs in a separate repository; keep this repo focused on applicant UX.
- Regenerate `src/lib/supabase.types.ts` after schema changes.
- Hosted app: `https://application-prototype.vercel.app`
