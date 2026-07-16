---
id: ADR-0004
status: active
date: 2026-07-15
---

# Service Contract Ownership

## Decision

Each external service owns and publishes its versioned API contract. Applications
pins the version and runs consumer compatibility tests.

## Why

Independently editable contract copies drift and make cross-repository changes
depend on memory.

## Consequences

Local contract documents are compatibility snapshots during migration, not an
independent authority. Phase 3 replaces them with provider-published artifacts.
