---
schema_version: 1
document_type: domain_contract
domain: documents
status: active
owner: src/lib/documentStorage.ts
---

# Documents Domain

## Owner

The shared document layer (`src/lib/documentStorage.ts` and `src/lib/storage/*`)
owns upload, replacement, deletion, and delivery. Supabase Storage/Postgres are
authoritative for applicant documents.

## Current contract

- Product flows require an authenticated Supabase session and use remote upload
  plus metadata.
- `localDocumentStore.ts` and its tests remain as a legacy implementation pending
  Phase 2 removal. They are not an approved path for new or changed product flows.
- Never store file names only; preserve binary content.
- The authenticated UC demo credit comparison is a narrow pre-application
  processing exception, not a stored applicant document. It sends one transcript
  to the marked eligibility route, keeps the file/result in memory, and creates no
  application or document metadata row during comparison. If the applicant
  explicitly starts an application, extracted study fields may prefill blank
  qualification data and the full file is attached to the matching qualification
  through the shared authenticated remote path. The three-course comparison result
  remains transient.

### Document kinds (Section 2 + feedback)

| Kind | Typical file | Notes |
|------|--------------|-------|
| `cv` | résumé PDF/DOC | Single per application |
| `transcript`, `certificate`, etc. | per tertiary row | See Section 2 upload sequence |
| `eligibility_feedback` | `eligibility-feedback.json` | Applicant dispute of automated evidence rows; schema v1 in `eligibilityFeedbackDocument.ts` |
| `employment_letter` | signed employer letter | Optional, one per employment role; supplied for admissions review and never submission-gated |

Migration: `supabase/migrations/20260705100000_eligibility_feedback_document.sql`
adds the enum value and optional `applications.eligibility_feedback_document_id` FK.
**Load contract:** hydration picks the latest `eligibility_feedback` row from
`application_documents` (`findEligibilityFeedbackDocument`) — not the FK column alone.

Migration `supabase/migrations/20260716090000_work_experience_assessment.sql` adds
`employment_letter` plus optional document ID/name columns on `employment_experiences`.
Replacement and removal must use the shared document replacement/cleanup path. Removing or
CV-replacing a role cleans up its attached letter; missing letters never enter
`application_submission_missing_fields`.

## Approved entry points

- Shared component: `src/components/FileUpload.tsx`
- Native label-linked file input — no hidden-input click proxies.
- Actions: `add`, `view`, `remove` only (minimal, consistent).

## Remote Guardrails

Defaults (override via env):
- Max 30 files per application
- Max 100 MB total per application
- Max 20 uploads per 10 minutes per user

Enforced in client and DB:
- `supabase/migrations/0005_document_upload_limits.sql` — `application_documents` row limits
- `supabase/migrations/20260522120000_storage_quota_and_document_integrity.sql` — `storage.objects` limits (closes direct-storage bypass), metadata rows must reference a real object, submission requires backed documents

## Delivery

- Authenticated remote documents: proxy via `/api/document-delivery` with bearer token.
- Proxy returns `Cache-Control: no-store` and attachment disposition for sensitive MIME types.
- Localhost may fall back to signed URLs only when proxy unavailable.

## Cleanup

- Remote upload is intentionally foreground-safe rather than fully transactional:
  replacement saves the new document before deleting the previous one.
- Use `npm run documents:cleanup` for a dry-run admin scan of orphaned private
  bucket objects and `application_documents` rows whose storage object is gone.
- Add `-- --execute` only after reviewing the dry-run JSON. The script requires a
  service-role key via `SUPABASE_SERVICE_ROLE_KEY`.

## Section 2 upload sequence

1. `ensureApplicationRow()` — shell-only application persist (no child-table rewrite). See [applications.md](applications.md).
2. `saveDocumentAttachment({ kind, ... })` — replace/delete through the shared storage layer.
3. Collection mutator or CV exception (`uploadCV` / `removeCV`) — attach metadata to application state.

Optional parse layer on top: [document-parsing.md](document-parsing.md).

## Key Files

| File | Role |
|------|------|
| `src/lib/documentStorage.ts` | Public barrel (re-exports storage modules) |
| `src/lib/storage/localDocumentStore.ts` | Legacy IndexedDB implementation; Phase 2 removal |
| `src/lib/storage/remoteDocumentUpload.ts` | Supabase upload + metadata rows |
| `src/lib/storage/documentDelivery.ts` | Proxy fetch, view, download |
| `src/lib/storage/documentReplace.ts` | Replace, duplicate, delete orchestration |
| `scripts/document-orphan-cleanup.mjs` | Dry-run-first orphaned remote document cleanup |
| `src/lib/documentAttachment.ts` | Attachment metadata helpers |
| `src/features/section2/section2DocumentSave.ts` | Kind-generic Section 2 document save |
| `src/lib/eligibility/eligibilityFeedbackDocument.ts` | Feedback JSON payload + `saveEligibilityFeedbackDocument` |
| `src/lib/documentUploadLimits.ts` | Quota constants + friendly errors |
| `src/components/DocumentUploadField.tsx` | Form field wrapper |
| `api/document-delivery.ts` | Server proxy |

## Forbidden shortcuts

- Anonymous applicant-document storage or page-local IndexedDB access.
- Page-local `FileUpload` orchestration, Supabase uploads, or delivery URLs.
- File-name-only persistence.
- Navigation changes as a side effect of fixing document storage; fix shared
  primitives and orchestration first.

## Intentional mirrors

- Client file-size/count checks mirror authoritative Supabase constraints for
  immediate feedback. Upload-limit and storage-integrity tests protect them.
- Document metadata and private storage objects are two parts of one logical
  document. Cleanup is deliberately asynchronous because browser code cannot make
  Storage and Postgres transactional.

## Required checks

- `src/lib/documentStorage.test.ts`
- `src/lib/documentUploadLimits.test.ts`
- document replacement/delivery tests relevant to the change
- `npm run documents:cleanup` in dry-run mode for cleanup-operation changes

## Related decisions

- [ADR-0001: Authenticated Applicant Data](../decisions/0001-authenticated-applicant-data.md)
- [ADR-0006: Repository Context Control Plane](../decisions/0006-context-control-plane.md)
