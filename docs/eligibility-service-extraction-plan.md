# Eligibility Service — Repo Extraction Plan

> Status: **proposal for review**. No code moved yet. Resolves the drift flagged in
> the code review: `eligibility-service/` lives in this repo, but `docs/current-phase.md`
> calls for eligibility/integration work to run as a separate workstream/repo.

## Why extract

- `docs/current-phase.md` (Track C / Delivery Setup) explicitly says to run the
  eligibility backend as a **separate project/workstream** with a **versioned contract
  boundary**, decoupled from the applicant app's release cadence and CI.
- The service is already self-contained: its own `package.json`, `Dockerfile`,
  `render.yaml`, and `src/server.mjs` (493 lines). It shares nothing with the app at
  the code level — the only link is an HTTP contract.
- Keeping it in-repo couples two independently-deployed units in one CI pipeline and
  one git history, which is exactly what the roadmap warns against.

## Current coupling (what actually ties them today)

The coupling is **purely an HTTP contract**, not shared code:

- App → service: `api/evaluate-transcript-eligibility.ts` POSTs multipart
  (`file` + `context`) to `process.env.ELIGIBILITY_SERVICE_URL`, with optional
  `Authorization: Bearer ${ELIGIBILITY_SERVICE_TOKEN}`.
- Service → app: JSON assessment with the four-status outcome
  (`eligible | conditionally_eligible | ineligible | insufficient_data`) plus the
  evidence groups the app's matcher consumes.
- When `ELIGIBILITY_SERVICE_URL` is unset, the app falls back to a local OpenAI call
  and then to a static `insufficient_data` response — so **the app keeps working with
  no service at all**. Extraction does not change that.

There is **no shared import** between `src/` / `api/` and `eligibility-service/src/`.
That makes this a clean lift-out.

## Target end state

- New repo `eligibility-service` (own remote, CI, deploy).
- This repo keeps only: the proxy (`api/evaluate-transcript-eligibility.ts`), the
  app-side matcher/rules, and a **versioned contract artifact** (see below).
- A copy of the request/response contract is shared by both sides so changes are
  reviewed deliberately.

## Migration steps (proposed)

1. **Freeze the contract.** Extract the request/response shape the proxy and service
   agree on into a single source of truth: `docs/contracts/eligibility-evaluate.v1.md`
   (+ optionally a JSON Schema). Today the truth is implicit in
   `eligibility-service/src/server.mjs` (`REQUIRED_RESPONSE_FIELDS`, the field schemas)
   and `api/evaluate-transcript-eligibility.ts`. Write it down first; nothing else
   should start until this is reviewed.
2. **History-preserving move.** Create the new repo from the subtree so history is kept:
   ```bash
   git subtree split --prefix=eligibility-service -b eligibility-service-export
   # push that branch as the initial main of the new repo
   ```
   (Alternatively `git filter-repo --path eligibility-service/` for a cleaner root.)
3. **Stand up CI/deploy in the new repo.** Move `render.yaml` to the repo root, wire
   Render auto-deploy + the `/healthz` check, set `OPENAI_API_KEY` / `SERVICE_API_TOKEN`
   / `SERVICE_VERSION` as deploy secrets. Add a minimal test/lint workflow.
4. **Pin the contract on the app side.** Add `docs/contracts/eligibility-evaluate.v1.md`
   to *this* repo and a contract test that asserts the proxy sends/accepts exactly v1
   (extends the existing `api/evaluate-transcript-eligibility.test.ts`).
5. **Remove the in-repo copy.** Delete `eligibility-service/` from this repo in the same
   PR that adds the contract doc + a README pointer to the new repo. Keep
   `ELIGIBILITY_SERVICE_URL` / `ELIGIBILITY_SERVICE_TOKEN` env wiring unchanged.
6. **Update docs.** `current-phase.md`, `eligibility-check-roadmap.md`,
   `project-memory.md`: record the new repo URL and the contract location.
7. **CI cross-repo guard (optional, later).** A contract-compatibility check that fails
   if the app's pinned vX contract diverges from the service's published one.

## Acceptance criteria

- New repo builds, deploys to Render, `/healthz` green.
- This repo: `npm test` + `npm run check:api-esm` pass with `eligibility-service/` gone.
- Hosted app against the deployed service returns the same four-status outcomes as
  the synthetic transcript fixtures expect.
- `ELIGIBILITY_SERVICE_URL` unset → app still falls back cleanly (unchanged behavior).

## Risks & mitigations

- **Contract drift between repos.** → Pin a versioned contract on both sides + the
  optional CI compatibility guard (step 7).
- **Secret duplication.** `OPENAI_API_KEY` now lives in two deploy targets. → Document
  ownership; consider the service being the *only* holder long-term (app fallback then
  becomes "insufficient_data only").
- **Lost history / blame.** → Use subtree/filter-repo (step 2), not a bare copy.
- **Local dev friction.** Contributors now clone two repos. → `npm run dev:transcript-eligibility-api`
  already provides a local stand-in; document that the external repo is only needed for
  full end-to-end testing.

## Decisions (locked 2026-06-03)

- **Repo home:** `github.com/carroll-john/eligibility-service` — a new repo under the
  existing account (no org). Easy to move into an org later if it grows.
- **First-move scope:** **lift-and-shift as-is** (history-preserving). The app keeps its
  local-OpenAI + static fallback; folding that into the service is deferred.

### Still requires an account action from you (cannot be done from this repo)

Creating the GitHub remote and the Render service are your actions. Once the
`carroll-john/eligibility-service` repo exists, the history-preserving move is:

```bash
# in this repo
git subtree split --prefix=eligibility-service -b eligibility-service-export
git push git@github.com:carroll-john/eligibility-service.git eligibility-service-export:main
```

Then move `render.yaml` to the new repo root, set `OPENAI_API_KEY` / `SERVICE_API_TOKEN`
/ `SERVICE_VERSION` in Render, and confirm `/healthz`. After the service deploys, the
in-repo `eligibility-service/` is removed here in a PR that also adds the pinned v1
contract doc + contract test (steps 1, 4, 5 above). App `ELIGIBILITY_SERVICE_URL` /
`ELIGIBILITY_SERVICE_TOKEN` env wiring is unchanged.
