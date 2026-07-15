---
id: ADR-0002
status: active
date: 2026-07-15
---

# Server-Authoritative Submission

## Decision

The server submit contract is the final authority on whether an application may
transition from draft to submitted. Browser validation mirrors the rules only to
give immediate, useful feedback.

## Why

Client bundles can be stale or bypassed. Final invariants must be enforced at the
trusted state transition.

## Consequences

Every client-only submission rule requires a matching server rule or persisted
policy. Intentional mirrors must have contract tests.
