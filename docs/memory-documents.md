# Memory: Documents

## Model

- Hybrid storage in `src/lib/documentStorage.ts`:
  - Authenticated Supabase session → remote upload + metadata
  - No session → IndexedDB local fallback
- Never store file names only; preserve binary content.

### Document kinds (Section 2 + feedback)

| Kind | Typical file | Notes |
|------|--------------|-------|
| `cv` | résumé PDF/DOC | Single per application |
| `transcript`, `certificate`, etc. | per tertiary row | See Section 2 upload sequence |
| `eligibility_feedback` | `eligibility-feedback.json` | Applicant dispute of automated evidence rows; schema v1 in `eligibilityFeedbackDocument.ts` |

Migration: `supabase/migrations/20260705100000_eligibility_feedback_document.sql`
adds the enum value and optional `applications.eligibility_feedback_document_id` FK.
**Load contract:** hydration picks the latest `eligibility_feedback` row from
`application_documents` (`findEligibilityFeedbackDocument`) — not the FK column alone.

## Upload UX

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

1. `ensureApplicationRow()` — shell-only application persist (no child-table rewrite). See [memory-applications.md](memory-applications.md).
2. `saveDocumentAttachment({ kind, ... })` — replace/delete via hybrid storage.
3. Collection mutator or CV exception (`uploadCV` / `removeCV`) — attach metadata to application state.

Optional parse layer on top: [memory-document-parsing.md](memory-document-parsing.md).

## Key Files

| File | Role |
|------|------|
| `src/lib/documentStorage.ts` | Public barrel (re-exports storage modules) |
| `src/lib/storage/localDocumentStore.ts` | IndexedDB local documents |
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

## Agent Module Boundary

Owns: upload, storage, delivery proxy integration.
Do not change form page navigation when fixing upload bugs — fix shared primitives first.
