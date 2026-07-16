---
id: ADR-0007
status: active
date: 2026-07-15
---

# Integration Platform Boundary

## Decision

The university integration platform remains a separate repository and service
with its own deployment and release lifecycle. Applications connects through
versioned APIs or events, never shared database tables.

## Why

Applicant UX and university-delivery orchestration have different responsibilities,
failure modes, and operational ownership.

## Consequences

Integration-platform plans are context only in this repository. Runtime coupling
requires an explicit published contract.
