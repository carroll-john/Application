# Eligibility Rules Engine v1 — Implementation Plan

> Status: **proposal for review**. No feature code yet. Targets the roadmap item
> "Stand up rules engine v1 with per-program reason codes and explanation payloads"
> (`docs/eligibility-check-roadmap.md` → Next 3 Tasks #3, Phase 2.1).

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

### PR 5 — Coverage + legacy retirement (optional, later)
- Broaden `requirements.generated.json` to the full catalog via
  `scripts/parse-course-requirements.ts`.
- Once coverage is complete and matcher emits all four statuses, plan deprecation of the
  legacy `deterministicRules.ts` path (keep as fallback until coverage is proven).

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

## Decision needed from you

- **The `conditionally_eligible` trigger rule** (PR 2): explicit `weight: "conditional"`
  on requirements, or a derived rule? This shapes the schema and the offline parser.
- Whether to **retire `deterministicRules.ts`** in this effort or keep it as a fallback.
