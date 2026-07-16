# Archived Eligibility Rules Engine v1 — Implementation Plan

> **Archived 2026-07-15.** This implementation plan is historical.

> Status: **v1 core shipped (2026-06-03)**. Targets the roadmap item "Stand up rules
> engine v1 with per-program reason codes and explanation payloads"
> (`docs/eligibility-check-roadmap.md` → Next 3 Tasks #3, Phase 2.1).
>
> - [x] **PR 1** — reason codes (#99)
> - [x] **PR 2** — `conditionally_eligible` via `weight: "conditional"` (#100)
> - [x] **PR 3** — single `RULES_VERSION` constant (#101)
> - [x] **PR 4** — four-status contract coverage through the proxy (this PR)
> - [x] **PR 5** — coverage audit + routing-lock test (this PR). Finding: coverage is
>   already complete (34/34 parsed); 24 route to the matcher, 10 to the legacy fallback
>   (1 empty + 9 multi-pathway the flat schema can't represent). `deterministicRules.ts`
>   is **load-bearing and retained**; full retirement is reclassified as a v2 item
>   (needs a nested-pathway schema).

## Where we already are

A surprising amount of "v1" already exists from the requirements-matcher work:

- **Rules schema** — `src/lib/eligibility/requirements.ts`: `RequirementInstance` with
  6 kinds (`qualification_completed`, `qualification_level`, `academic_threshold`,
  `english_proficiency`, `work_experience`, `field_of_study`), `params`, `weight`
  (`mandatory | alternative`), `alternativeGroupId`, `sourceText`.
- **Per-course rules data** — `requirements.generated.json`, produced offline by
  `scripts/parse-course-requirements.ts` (committed + PR-reviewed), covering a subset of
  courses today.
- **Evaluator** — `src/lib/eligibility/requirementEvaluators.ts` (the 6 kind evaluators)
  + `matcher.ts` (`evaluateRequirements` with alternative-group folding, `aggregateOutcome`).
- **Proxy integration** — `api/evaluate-transcript-eligibility.ts` chooses the matcher
  when canonical requirements are supplied, else the legacy `deterministicRules.ts`.

So v1 is less "build from scratch" and more "close the gaps and formalize the contract."

## Gaps vs the roadmap's v1 definition

1. **No `conditionally_eligible` from the matcher.** `aggregateOutcome` only emits
   `eligible | ineligible | insufficient_data`. The four-status model (defined in
   `types.ts`, emitted by the legacy `deterministicRules.ts`, rendered by `uiCopy.ts`)
   is therefore **not reachable via the matcher path** — a real semantic gap.
2. **No stable reason codes.** Checks carry free-text `explanation` only. The roadmap's
   output contract specifies `reasonCodes[]` — machine-readable, stable across copy edits,
   usable for analytics and UI branching.
3. **`rulesVersion` is ad hoc.** The proxy string-appends `+matcher-v1`; there's no single
   versioned constant tying outputs to a rules definition.
4. **Contract/fixture coverage is partial.** Phase 2.1 wants explicit contract tests for
   proxy forwarding, upstream error mapping, and fallback, plus synthetic fixtures that
   pin all four outcomes. Some exist; four-status coverage is incomplete (no
   `conditionally_eligible` fixture can pass through the matcher until gap #1 is fixed).
5. **Generated-requirements coverage is incomplete** across the catalog.

## Proposed scope for v1 (each a separate PR)

### PR 1 — Reason codes (additive, no behavior change)
- Add a `RequirementReasonCode` enum (e.g. `QUALIFICATION_INCOMPLETE`,
  `LEVEL_BELOW_REQUIRED`, `WAM_BELOW_MIN`, `GPA_BELOW_MIN`, `NO_ACADEMIC_EVIDENCE`,
  `ENGLISH_OK_COUNTRY`, `ENGLISH_UNVERIFIED`, `WORK_EXPERIENCE_UNVERIFIED`,
  `FIELD_MATCH`, `FIELD_MISMATCH`, `PROGRAM_NAME_MISSING`, …).
- Have `buildRequirementCheck` / each evaluator attach a `reasonCode` alongside the
  existing `explanation`. Explanations stay; codes are added.
- Extend `EligibilityRequirementCheck` in `types.ts` with optional `reasonCode`.
- Unit tests assert (kind, evidence) → reasonCode. Pure, low risk.

### PR 2 — `conditionally_eligible` in `aggregateOutcome`
- Introduce the notion of a **waivable/soft** failure or "meets-with-conditions" check
  (e.g. an alternative pathway partially satisfied, or a threshold missed within a
  tolerance the policy marks as conditional). Define the precedence:
  `fail (hard) > conditional > unknown > pass`.
- Decide the trigger rule with you — options: (a) a requirement flagged
  `weight: "conditional"`, or (b) derived (e.g. all-but-one mandatory pass + the miss is
  a known-waivable kind). **This is a policy decision, not just code.**
- Add fixtures that exercise the new status end-to-end through the proxy.

### PR 3 — Versioning
- A single `RULES_VERSION` constant (e.g. `rules-v1`) stamped on every assessment;
  replace the ad-hoc `+matcher-v1` string concat. Record `profileVersion` too if/when
  the evidence schema is versioned.

### PR 4 — Contract + fixture hardening (Phase 2.1)
- Synthetic-transcript fixtures pinning **all four** outcomes through
  `api/evaluate-transcript-eligibility`.
- Contract tests: proxy forwarding shape, upstream non-OK error mapping, and the
  no-service fallback (extend the existing 10-case suite).
- Align the documented response schema with what the UI renders (`uiCopy.ts`).

### PR 5 — Coverage audit + routing lock (revised after investigation, 2026-06-03)

Investigation finding: **catalog coverage is already complete** — all 34 courses have
generated entries in `requirements.generated.json`. But the matcher does **not** run for
all of them. Actual routing:

- **24/34 courses → matcher** (non-empty, matcher-safe requirements).
- **10/34 courses → legacy `deterministicRules` fallback**:
  - 1 has no machine-parseable requirements (empty entry).
  - 9 are multi-pathway courses (`(A AND B) OR (C AND D)`) that the **flat requirement
    schema cannot represent**; `isMatcherUnsafe()` deliberately routes them to the
    fallback rather than evaluate them over-permissively.

**Therefore `deterministicRules.ts` is load-bearing and must NOT be retired** — re-running
the parser cannot fix the 9 unsafe courses, because the limitation is the flat schema, not
missing data. Retirement is reclassified as a **v2 item**: extend the schema to express
nested entry pathways, migrate those 9 courses, then deprecate the legacy path.

Shipped instead: a **routing-coverage test** (`requirementsLoader.test.ts`) that locks the
per-course matcher-vs-fallback split, so any future parser regen or schema change surfaces
routing changes in review instead of silently moving a course between engines.

(Optional, separate: re-run `scripts/parse-course-requirements.ts --code=<x>` for the one
empty course if its published text actually contains parseable requirements — needs an
`OPENAI_API_KEY` run + human review of the extracted rules.)

## Sequencing & risk

- PRs 1, 3, 4 are low-risk and independent — safe to land first.
- **PR 2 is the only one needing a product decision** (what makes an outcome
  "conditional"). Recommend we settle that rule before writing it.
- All work is behind the existing matcher-vs-deterministic switch, so it ships
  incrementally without destabilizing the current flow.

## Acceptance criteria for "v1 done"

- Matcher can emit all four statuses; fixtures pin each through the proxy.
- Every check carries a stable `reasonCode`; assessments carry a single `RULES_VERSION`.
- Contract tests cover forwarding, error mapping, and fallback.
- Docs updated per the roadmap's iteration protocol (decisions → roadmap → phase →
  memory → stakeholder note).

## Decisions (locked 2026-06-03)

- **`conditionally_eligible` trigger (PR 2):** add an explicit third requirement weight
  `"conditional"`. A missed **mandatory** requirement → `ineligible`; a missed
  **conditional** requirement (with no mandatory failures) → `conditionally_eligible`.
  This adds a `weight` value to `RequirementInstance` and a field the offline parser /
  curator sets. Outcome precedence becomes:
  `ineligible (any mandatory fail) > conditionally_eligible (only conditional fails) >
  insufficient_data (any unknown) > eligible`.
- **Legacy `deterministicRules.ts`:** **keep as the fallback** for courses without
  generated requirements. Retire only once `requirements.generated.json` covers the full
  catalog and the matcher emits all four statuses (PR 5, later).
