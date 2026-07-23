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

The UC three-course credit comparison is a second narrow pre-application case,
but it is not anonymous. Sign-in is required before the transcript control is
shown, and the marked API route validates the bearer session before reading the
file. The transcript and comparison are ephemeral and create no hidden draft.

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

Authenticated UC demo visitors may process one transcript for a three-course
credit comparison. Refreshing or closing the page discards the shortlist,
transcript and results. A later application uses the ordinary persisted document
flow; the comparison transcript is not silently transferred.
