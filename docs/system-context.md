---
schema_version: 1
document_type: system_context
status: active
last_verified: 2026-07-15
authoritative_for:
  - runtime_topology
  - repository_and_module_ownership
  - separation_of_concerns
  - intentional_mirrors
  - context_loading_order
---

# System Context

This is the authoritative map of the Applications system. It defines current
runtime topology, ownership, boundaries, and permitted duplication. Domain
details belong in [`domains/`](domains/); reasons for significant choices belong
in [`decisions/`](decisions/).

## Conflict rule

- Code and executable tests establish current behaviour.
- This document establishes intended ownership and boundaries.
- A mismatch is a defect to resolve explicitly. Do not silently declare either
  the code or documentation stale.
- Planned migrations are labelled below and must not be described as complete.

## Context loading order

1. The worktree-local `TASK.md`, when present.
2. This system context.
3. The relevant domain contract under [`domains/`](domains/).
4. Only the active decisions linked by that domain contract.
5. Workflow guides or operational runbooks only when the task needs them.

Linear is the source of current priorities. Repository documentation does not
maintain a separate current-phase list.

## Runtime topology

| Flow | Runtime path | Boundary |
| --- | --- | --- |
| Auth | Browser → Supabase Auth | `AuthContext` is the single browser session owner; route gates consume it. |
| Application data | Browser → `ApplicationStorageAdapter` → Supabase Postgres | Applications require authentication. Supabase and the submit RPC are authoritative. |
| Documents | Browser → shared document layer → Supabase Storage/Postgres | Product flows require authentication. A legacy IndexedDB implementation still exists pending Phase 2 removal. |
| Submission | Browser validation → remote store → `submit_application` RPC | The server is final authority; browser checks are a UX mirror. |
| CV parsing | Browser → `/api/parse-cv` → OpenAI | The app API owns CV extraction orchestration. |
| Transcript evidence | Browser → `/api/evaluate-transcript-eligibility` → `eligibility-service` → OpenAI | The service extracts evidence; the Applications proxy owns program decisions. A local app OpenAI fallback still exists pending Phase 3 removal. |
| Suggestions | Browser → `/api/suggest/*` → `suggest-service` | The service owns institution/address suggestions. Local lists remain as a legacy fallback pending Phase 3 removal. |
| Analytics | Browser/API → PostHog | Typed analytics wrappers own event shape and privacy controls. |
| Monitoring | Browser/API → Sentry | Monitoring is fail-open and must not own applicant-flow decisions. |

## External project classification

| Project or service | Classification | Responsibility |
| --- | --- | --- |
| Supabase | Runtime dependency | Auth, Postgres, private document storage, RLS, submission RPC. |
| `eligibility-service` | Runtime dependency | Conservative transcript evidence extraction only. It does not own final program eligibility. |
| `suggest-service` | Runtime dependency | Institution indexing, address suggestion, and Google Places integration. |
| OpenAI | Runtime dependency | Reached through server-side parsing/extraction routes only. |
| Integration platform | Context only | Separate repository and release lifecycle; connects through versioned contracts, never shared tables. |
| `aus-uni-intel` and legacy prototypes | Context only | Research or historical reference; no Applications runtime coupling. |

Live deployment health, environment values, and service availability are not
recorded here. Verify those through the commands in
[`workflows/agent.md`](workflows/agent.md) and the relevant runbook.

## Ownership map

| Concern | Authoritative owner | Approved consumers | Forbidden shortcut |
| --- | --- | --- | --- |
| Browser auth/session | `src/context/AuthContext.tsx` and shared route gates | Pages and features through `useAuth` | Page-local session listeners or auth gates. |
| Application shape | `src/lib/applicationData.ts` | Context, validation, persistence mappers | Parallel page-specific application models. |
| Application persistence | `src/lib/applicationStorageAdapter.ts` | Application context/hooks | Pages importing remote stores or branching storage modes. |
| Submission permission | Supabase `submit_application` and `application_submission_missing_fields` | Client validation as a UX mirror | Treating client readiness as final authority. |
| Document save/delivery | `src/lib/documentStorage.ts`, `src/lib/storage/*`, `/api/document-delivery` | Shared upload fields and Section 2 save orchestration | Page-local upload, storage, or delivery implementations. |
| Parser orchestration | `api/_documentParser/*` and registered client policies | Kind-specific parsers | Copying upload/save orchestration per document kind. |
| Transcript exception | `useSection2TertiarySaveWithParse` and eligibility proxy | Tertiary flow only | Duplicating shared upload, attachment, or persistence logic. |
| Eligibility rules | `vendor/eligibility-rules` in this repository | App shims, proxy matcher, course tooling | Editing an independent rules implementation in a service repo. |
| Transcript extraction | `eligibility-service` | Applications proxy through its pinned service contract | A second long-term extraction implementation in the app. |
| Suggestions | `suggest-service` | Applications `/api/suggest/*` proxy | Browser Google calls or independently maintained app suggestion data. |
| UI design system | `src/index.css`, `src/components/ui/*`, and shared product primitives | Pages and features | External design-file instructions, page-local brand tokens, or duplicate base controls. |

## Intentional mirrors

Duplication is allowed only when it is named here, has one authority, and is
generated or protected by an executable contract check.

| Mirror | Authority | Reason | Enforcement |
| --- | --- | --- | --- |
| Client submission feedback vs server submit gate | Server RPC | Immediate UX plus hard server enforcement | Validation and submission integration tests. |
| English-country and AHPRA constants in TypeScript and SQL | Eligibility rules package | SQL cannot import TypeScript directly | `submitPolicyContract.test.ts`. |
| Client upload limits vs database/storage limits | Supabase constraints | Friendly preflight plus hard backend limits | Upload-limit and storage-integrity tests. |
| Consumer service-contract snapshot | Provider-published contract | Compatibility testing at the caller | Contract tests; provider publication/pinning completes in Phase 3. |

No other business-rule duplication is implicitly permitted.

## Agreed migrations

These decisions are active, but the listed implementation work is not complete:

| Phase | Migration | Completion condition |
| --- | --- | --- |
| 2 | Remove anonymous IndexedDB applicant-document storage | No applicant/profile/application/eligibility/document data is stored locally; browser storage contains UI/session conveniences only. |
| 2 | Enforce module boundaries automatically | CI rejects direct page imports of auth, persistence, document, and service internals. |
| 3 | Make Applications the sole eligibility-rules source | The service-repo copy is removed or replaced by a pinned Applications-owned package artifact. |
| 3 | Remove local transcript AI extraction | Service outage returns safe `insufficient_data`/manual-review guidance. |
| 3 | Remove local suggestion datasets | Service outage falls back to manual text entry only. |
| 3 | Publish provider-owned API contracts | Services publish versioned schemas/artifacts; Applications pins and tests them without editable copies. |

## Context maintenance

- Update this file in the same change as an ownership or boundary change.
- Update one domain contract when implementation behaviour changes.
- Add a decision record only for a consequential, hard-to-reverse choice.
- Move superseded plans to [`archive/`](archive/) and dated assessments to
  [`reviews/`](reviews/); neither is current guidance.
- Run `npm run context:check` before finishing documentation changes.
