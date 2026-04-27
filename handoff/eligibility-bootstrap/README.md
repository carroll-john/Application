# Eligibility Repo Bootstrap Handoff

This folder is a seed package to move eligibility-project documentation and setup guidance into the dedicated `eligibility` repository.

## Included artifacts
- `docs/eligibility-check-roadmap.md`
- `docs/eligibility-repo-separation.md`
- `docs/stakeholder-updates/2026-04-27-eligibility-note.md`
- `docs/stakeholder-updates/README.md`

## Suggested target layout in `eligibility` repo
```
docs/
  eligibility-check-roadmap.md
  stakeholder-updates/
    README.md
    2026-04-27-eligibility-note.md
  decisions.md
  current-phase.md
  project-memory.md
```

## First setup steps in the new repo
1. Copy the included docs into the target `docs/` structure.
2. Add backend bootstrap docs:
   - `docs/architecture.md`
   - `docs/data-contracts.md`
   - `docs/api-contracts.md`
   - `docs/operations.md`
3. Create baseline implementation scaffolding:
   - `src/api/`
   - `src/workers/`
   - `src/rules/`
   - `src/storage/`
4. Add CI checks:
   - markdown linting
   - typecheck
   - unit tests

## Why this exists
Network restrictions in this environment prevented direct clone/push to `https://github.com/carroll-john/eligibility`. This package is ready to copy into that repo once available from your side.
