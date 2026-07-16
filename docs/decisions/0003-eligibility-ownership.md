---
id: ADR-0003
status: active
date: 2026-07-15
---

# Eligibility Ownership

## Decision

The Applications repository owns program eligibility rules and final decision
assembly. `eligibility-service` owns conservative transcript evidence extraction
only.

## Why

Decision authority belongs with the application and course context that consumes
the evidence. Keeping the extraction service policy-neutral avoids two competing
eligibility engines.

## Consequences

`vendor/eligibility-rules` is the current Applications-owned rule source. Phase 3
removes or replaces the independent service-repository copy and removes the app's
local transcript AI fallback.
