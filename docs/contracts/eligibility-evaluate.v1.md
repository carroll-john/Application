# Eligibility Evaluate — Contract v1

> **Status:** pinned (2026-06-03). This is the single source of truth for the HTTP
> boundary between the app and the external eligibility service. The machine-checkable
> mirror lives in [`api/_eligibility/contractV1.ts`](../../api/_eligibility/contractV1.ts);
> [`api/_eligibility/contractV1.test.ts`](../../api/_eligibility/contractV1.test.ts)
> asserts the proxy conforms to it. Change this doc, the constants, and the test together.

## Parties

- **Caller (app proxy):** `api/evaluate-transcript-eligibility.ts`.
- **Service:** `eligibility-service`, deployed separately —
  repo [`github.com/carroll-john/eligibility-service`](https://github.com/carroll-john/eligibility-service),
  exposes `POST /api/evaluate`.

The coupling is **purely this HTTP contract**. There is no shared code import.

## Transport

- **Method / URL:** `POST {ELIGIBILITY_SERVICE_URL}` (the env var points at the service's
  `/api/evaluate`).
- **Body:** `multipart/form-data` with exactly two parts:
  | part | type | meaning |
  |------|------|---------|
  | `file` | binary | the transcript (PDF, DOC, DOCX, PNG, JPEG, or TXT; service caps at 5 MB) |
  | `context` | string | JSON program context (see below) |
- **Auth:** when `ELIGIBILITY_SERVICE_TOKEN` is set, the proxy sends
  `Authorization: Bearer {token}`. The service compares it to its own `SERVICE_API_TOKEN`:
  missing → `401 ELIGIBILITY_SERVICE_UNAUTHORIZED`, mismatch → `403 ELIGIBILITY_SERVICE_FORBIDDEN`.
  When the service has no token configured, auth is skipped.

### `context` JSON fields (all optional)

`completed` (bool), `country`, `courseCode`, `courseTitle`, `entryRequirementsText`,
`institution`, `languageTestsCount` (num), `level`, `minGpaScale` (num), `minGpaValue` (num),
`minWam` (num), `qualificationLevelRequirement`.

> The proxy may also include a `requirements` array in `context`. **The service ignores it** —
> requirement matching runs app-side (see "App-side resolution"). It is forwarded only so the
> service payload and the app context stay a single object.

## Response (HTTP 200)

A JSON assessment object. A v1 response **must** include every one of these top-level fields
(the service enforces this via `REQUIRED_RESPONSE_FIELDS`; an incomplete model response is
rejected upstream as `502`):

`academicPerformance`, `applicantDetails`, `checkedAt`, `confidence`,
`englishLanguageEvidence`, `manualReviewRequired`, `missingInformation`, `outcome`,
`programCode`, `programTitle`, `recommendedNextStep`, `rulesVersion`, `serviceVersion`,
`studyDetails`.

- **`outcome`** is one of the four statuses, in precedence order
  (`ineligible` > `conditionally_eligible` > `insufficient_data` > `eligible`):
  `eligible | conditionally_eligible | ineligible | insufficient_data`.
- **Evidence groups** — `applicantDetails`, `studyDetails`, `academicPerformance`,
  `englishLanguageEvidence` — are each a map of nullable *extracted field* objects:
  ```json
  { "confidence": 0.0, "missingOrAmbiguous": false, "normalizedValue": null, "originalValue": null }
  ```
- **Academic unit rows** — newer v1-compatible extractors may also include
  `academicPerformance.unitResults`, an array of transcript unit/result rows with
  `unitCode`, `title`, `creditPoints`, `mark`, `grade`, `notes`, and `counted`.
  This is additive: the app uses it to calculate WAM when no aggregate WAM is shown,
  while older v1 responses without `unitResults` remain valid.

### Service responsibility boundary

The service is a **conservative evidence extractor**, not the eligibility decision-maker. It
populates the evidence groups and returns `outcome=insufficient_data` when overall evidence is
weak, otherwise `outcome=eligible`. The **app owns the requirement-by-requirement decision.**

## App-side resolution (what the proxy does with the response)

`api/_eligibility/assessment.ts#applyEligibilityResolution`:

- If `context.requirements` is present → the **matcher** recomputes `outcome`,
  `requirementsChecked`, and `manualReviewRequired` from the evidence groups, and stamps
  `rulesVersion` with `+rules-v1`. For multi-entry courses it also adds
  `selectedPathwayId` and `pathwayResults`, and `requirementsChecked` contains global
  requirements plus the selected pathway only.
- Otherwise → the **legacy deterministic rules** run.

So the **final** outcome the app returns to its client may differ from the service's raw
`outcome`. The transport contract guarantees the *shape*; the app owns the *verdict*.

## Errors

| Status | code | source |
|--------|------|--------|
| 401 | `ELIGIBILITY_SERVICE_UNAUTHORIZED` | service — missing bearer token |
| 403 | `ELIGIBILITY_SERVICE_FORBIDDEN` | service — wrong bearer token |
| 400 | `ELIGIBILITY_FILE_REQUIRED` | service — no `file` part |
| 502 | `ELIGIBILITY_SERVICE_EVALUATION_FAILED` | service — model/upstream failure |
| upstream status | `ELIGIBILITY_SERVICE_UPSTREAM_ERROR` | proxy — re-wraps any non-OK service response |

## Fallback (service optional)

If `ELIGIBILITY_SERVICE_URL` is **unset**, the app does not call the service at all: it tries a
local OpenAI evaluation, then a static `insufficient_data` response. The app keeps working with
no service deployed, so extraction never blocks the applicant flow.

## Versioning

This is **v1**. Any breaking change to the request parts, the `context` fields the service
reads, the required response fields, the evidence-field shape, or the outcome enum requires a
**v2** doc + a new pinned contract artifact on both sides — not an in-place edit here.
