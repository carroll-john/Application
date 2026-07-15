---
id: ADR-0001
status: active
date: 2026-07-15
---

# Authenticated Applicant Data

## Decision

Applications, applicant profiles, eligibility evidence, and documents require an
authenticated session. Supabase is authoritative. Browser storage may hold only
non-authoritative UI/session conveniences.

## Why

Anonymous application and document stores create a second persistence model,
complicate account transitions, and make privacy and recovery behaviour harder to
reason about.

## Consequences

Signed-out visitors may browse but cannot own a draft or upload applicant data.
The legacy IndexedDB document implementation is removed in Phase 2.
