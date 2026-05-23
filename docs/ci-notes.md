# CI Notes

## Eligibility contract status check

Use the following required status check for branch protection when transcript eligibility files are in scope:

- `Eligibility Contract / eligibility-contract`

This check is produced by:

- Workflow: `.github/workflows/eligibility-contract.yml`
- Job: `eligibility-contract`

It runs `npm run test:eligibility-contract` for path-filtered changes to:

- `api/evaluate-transcript-eligibility.ts`
- `api/evaluate-transcript-eligibility.test.ts`
- `api/__fixtures__/transcript-service-contract.json`
- `src/lib/eligibility/**`
- `package.json`
- `package-lock.json`
