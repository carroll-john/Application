---
id: ADR-0008
status: active
date: 2026-08-04
---

# Assessment Sessions and AAL2 Staff Review

## Decision

The UC treatment journey uses a dedicated `AssessmentStorageAdapter` and
partner-scoped server persistence. Anonymous processing is limited to one
invitation-protected, ephemeral CV parse. Authentication is required before
transcript upload and before any assessment evidence or result is persisted.

All trusted estimates are calculated server-side from versioned, UC-approved
transcript mappings. Staff review requires an active partner role and AAL2 at
every boundary: API, RLS, document access, action, and export. Every case view,
document access, review action, and export is audited.

## Why

A resumable pre-application journey cannot safely use page memory or application
tables. A separate boundary prevents hidden application drafts while retaining
ownership, retention, provenance, and evidence controls. Staff access is more
sensitive than applicant self-service and therefore requires phishing-resistant
session elevation and partner isolation.

## Consequences

- UI code cannot import assessment persistence implementations.
- Assessment outcomes, roles, partner IDs, or AAL claims from the browser are not
  authoritative.
- Failed audit writes fail the protected staff action.
- Evidence remains quarantined until validation and scanning pass.
- Only an explicit application start may promote passed-scan documents; blank
  fields may be filled, but saved/applicant-entered values are preserved.
- Treatment can be disabled without disabling the control application journey.

## Related contracts

- [`../domains/applications.md`](../domains/applications.md)
- [`../domains/auth.md`](../domains/auth.md)
- [`../domains/documents.md`](../domains/documents.md)
- [`../contracts/uc-assessment.v1.md`](../contracts/uc-assessment.v1.md)
