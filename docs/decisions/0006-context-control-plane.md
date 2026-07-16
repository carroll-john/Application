---
id: ADR-0006
status: active
date: 2026-07-15
---

# Repository Context Control Plane

## Decision

`system-context.md` owns cross-cutting architecture; domain files own current
implementation contracts; decision records explain significant choices; Linear
owns current priorities; each coding worktree has an ignored `TASK.md`.

## Why

Mixing durable architecture, historical decisions, and fast-changing priorities
caused contradictory guidance for humans and agents.

## Consequences

Context files use a consistent structure and CI validates them. Historical
reviews and superseded plans cannot override current guidance.
