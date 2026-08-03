---
id: ADR-0001
status: active
date: 2026-07-15
updated: 2026-08-04
---

# Authenticated Applicant Data

## Decision

Applications, applicant profiles, eligibility evidence, and documents require an
authenticated session. Supabase is authoritative. Browser storage may hold only
non-authoritative UI/session conveniences.

The invitation-protected UC treatment journey is a narrow exception. It may parse
one CV before sign-in into temporary, in-memory state under a shared database
rate limit. It does not persist the file or extraction. Sign-in with the
pre-invited account is required before transcript upload and before a resumable
assessment session may store confirmed CV data, evidence, or results.

The assessment session is not an application draft. Only an explicit Start
application action may promote passed-scan documents and fill blank application
fields through the shared authenticated application systems.

## Why

Anonymous application and document stores create a second persistence model,
complicate account transitions, and make privacy and recovery behaviour harder to
reason about.

## Consequences

Signed-out visitors may browse but cannot own a draft or upload applicant data.
The legacy IndexedDB document implementation is removed in Phase 2.

Signed-out treatment visitors may submit one CV for ephemeral parsing. The
endpoint requires an activated invitation and uses a cross-instance limiter.
Authenticated participants can resume their assessment without creating a hidden
application. Abandoned assessment documents are deleted after 30 days; promoted
documents follow application retention.
