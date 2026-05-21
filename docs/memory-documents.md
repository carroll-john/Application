# Memory: Documents

## Model

- Hybrid storage in `src/lib/documentStorage.ts`:
  - Authenticated Supabase session → remote upload + metadata
  - No session → IndexedDB local fallback
- Never store file names only; preserve binary content.

## Upload UX

- Shared component: `src/components/FileUpload.tsx`
- Native label-linked file input — no hidden-input click proxies.
- Actions: `add`, `view`, `remove` only (minimal, consistent).

## Remote Guardrails

Defaults (override via env):
- Max 30 files per application
- Max 100 MB total per application
- Max 20 uploads per 10 minutes per user

Enforced in client and DB (`supabase/migrations/0005_document_upload_limits.sql`).

## Delivery

- Authenticated remote documents: proxy via `/api/document-delivery` with bearer token.
- Proxy returns `Cache-Control: no-store` and attachment disposition for sensitive MIME types.
- Localhost may fall back to signed URLs only when proxy unavailable.

## Key Files

| File | Role |
|------|------|
| `src/lib/documentStorage.ts` | IndexedDB + remote upload + fetch |
| `src/lib/documentAttachment.ts` | Attachment metadata helpers |
| `src/lib/documentUploadLimits.ts` | Quota constants |
| `src/components/DocumentUploadField.tsx` | Form field wrapper |
| `api/document-delivery.ts` | Server proxy |

## Agent Module Boundary

Owns: upload, storage, delivery proxy integration.
Do not change form page navigation when fixing upload bugs — fix shared primitives first.
