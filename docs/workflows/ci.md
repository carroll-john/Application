# CI Workflow

## Main CI (`.github/workflows/ci.yml`)

- **Triggers:** `pull_request` (all branches) and `push` to `master` only. Feature/`codex/**` branches are not built on push alone, which avoids duplicate runs alongside PR checks.
- **Concurrency:** Superseded runs on the same ref are cancelled (`cancel-in-progress`).
- **`test-and-build`:** Always runs (lint, full Vitest, `check:api-esm`, build).
- **`llm-regression`:** Runs only when `check-secrets` confirms `OPENAI_API_KEY` and path filters match CV and/or transcript eligibility areas. Combines former `cv-parser-regression` and `transcript-eligibility-regression` jobs (single `npm ci`, conditional API startup per area).

## Eligibility contract status check

Use the following required status check for branch protection when transcript eligibility files are in scope:

- `Eligibility Contract / eligibility-contract`

This check is produced by:

- Workflow: `.github/workflows/eligibility-contract.yml`
- Job: `eligibility-contract`

It runs `npm run eligibility:eval` (offline matcher fixtures) for path-filtered changes. Vitest contract files in the same paths are already covered by `CI / test-and-build` (`npm test`).

Path-filtered workflow triggers include:

- `api/evaluate-transcript-eligibility.ts`
- `api/evaluate-transcript-eligibility.test.ts`
- `api/__fixtures__/transcript-service-contract.json`
- `src/lib/eligibility/**`
- `package.json`
- `package-lock.json`

(See the workflow file for the full path list.)

## Fork PRs

`OPENAI_API_KEY` is not available to workflows from fork PRs; `llm-regression` is skipped (same as before when the secret was missing).
