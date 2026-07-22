---
id: ADR-0001
status: active
date: 2026-07-15
updated: 2026-07-23
---

# Authenticated Applicant Data

## Decision

Applications, applicant profiles, eligibility evidence, and documents require an
authenticated session. Supabase is authoritative. Browser storage may hold only
non-authoritative UI/session conveniences.

The UC pre-application course-matching demo is a narrow exception. It may parse a
CV before sign-in into temporary, in-memory assessment state. It does not create
or persist an application, profile, eligibility record, or document. Sign-in is
required before Start application can transfer the CV and confirmed details into
the authenticated application flow.

## Why

Anonymous application and document stores create a second persistence model,
complicate account transitions, and make privacy and recovery behaviour harder to
reason about.

## Consequences

Signed-out visitors may browse but cannot own a draft or upload applicant data.
The legacy IndexedDB document implementation is removed in Phase 2.

Signed-out visitors to the UC pre-application assessment may submit a CV for
ephemeral parsing. The endpoint is IP-rate-limited, the browser does not persist
the result, and cancelling sign-in from Start application leaves the user in the
assessment without creating a draft.
