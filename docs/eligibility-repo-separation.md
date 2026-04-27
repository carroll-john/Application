# Eligibility Backend Repo Separation Plan

## Why separate now
The current `application-prototype` repository contains rapid-iteration UX and demo-era code. Keeping production-bound eligibility backend implementation in this repo will create long-term maintenance noise and ownership ambiguity.

## Boundary decision
- `application-prototype` keeps:
  - applicant UX
  - high-level eligibility flow contract docs
  - stakeholder status notes
- dedicated eligibility backend repo keeps:
  - ingestion/extraction/rules engine code
  - queue/worker/runtime infrastructure
  - Notion publishing automation and other operations scripts
  - deployment config, observability, and backend runbooks

## Minimal contract bridge between repos
1. Keep `docs/eligibility-check-roadmap.md` contract-oriented in this repo.
2. Mirror actionable implementation tasks in the backend repo.
3. Version API/event contracts and reference them from both repos.
4. Keep cross-repo changelog entries in stakeholder updates.

## Migration checklist
- [ ] Create new repository for eligibility backend and automation.
- [ ] Move Notion publish script and any backend utilities there.
- [ ] Wire CI/CD and environment secrets in the new repo.
- [ ] Add contract test gate between frontend-consumer and backend-provider schemas.
- [ ] Update project links in `docs/current-phase.md` once repo exists.
