# Suggest — Contract v1

> **Status:** pinned (2026-06-17). HTTP boundary between this app and the external
> suggest service. Machine-checkable mirror:
> [`api/_suggest/contractV1.ts`](../../api/_suggest/contractV1.ts);
> [`api/_suggest/contractV1.test.ts`](../../api/_suggest/contractV1.test.ts) asserts
> proxy conformance. Service repo copy:
> [`suggest-service/docs/contracts/suggest.v1.md`](../../../suggest-service/docs/contracts/suggest.v1.md).

## Parties

- **Caller (app proxy):** `api/suggest/institutions.ts`, `api/suggest/addresses.ts`.
- **Service:** `suggest-service` on Render.

No shared code import — HTTP contract only.

## Transport

- **Base URL:** `SUGGEST_SERVICE_URL`
- **Auth:** optional `Authorization: Bearer {SUGGEST_SERVICE_TOKEN}`
- **Proxied paths:**
  - `GET /api/suggest/institutions` → `GET /v1/institutions/suggest`
  - `GET /api/suggest/addresses` → `GET /v1/addresses/suggest` or `/v1/addresses/resolve`

When `SUGGEST_SERVICE_URL` is unset, proxies return `404 SUGGEST_SERVICE_NOT_CONFIGURED` and
frontends use local fallback lists / manual address entry.

See the service contract doc for full request/response field requirements.
