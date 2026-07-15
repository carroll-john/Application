---
id: ADR-0005
status: active
date: 2026-07-15
---

# Code-Based Design System

## Decision

The implemented design tokens and shared UI primitives are authoritative.
External design files are not a project dependency or source of truth.

## Why

The project is no longer maintained in an external design tool, while tokens and
reusable controls already exist in the repository.

## Consequences

New UI uses `src/index.css`, `src/components/ui/*`, and shared product primitives.
New variants extend those owners instead of adding page-local brand values.
