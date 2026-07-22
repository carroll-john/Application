---
schema_version: 1
document_type: domain_contract
domain: document-parsing
status: active
owner: api/_documentParser
---

# Document Parsing Domain

## Owner

`api/_documentParser/*` owns the shared parsing framework; registered client
policies own kind-specific gating and normalization. The transcript workflow is a
documented exception for course-context evaluation, not a separate upload system.

## Current contract

Upload/save is kind-generic; parsing is optional and registered per
`DocumentKind` except for the transcript workflow described below.

- **Upload layer** — all Section 2 document pages use `saveSection2DocumentRecord({ kind })` + `saveDocumentAttachment`. See [documents.md](documents.md).
- **Parse layer** — opt-in via `useSection2DocumentSaveWithParse` + a per-kind `DocumentParsePolicy` config in `src/features/section2/`.
- **Registry** — client `documentParserRegistry` maps `ParseableDocumentKind` → API route + normalizer. Starts with `"cv"` only.
- **API** — shared core in `api/_documentParser/`; kind-specific extraction in `api/_documentParser/kinds/{kind}/`. Thin route wrappers (e.g. `api/parse-cv.ts`) call shared core + kind module.

## Gating

Each kind policy defines `shouldParse(ctx)` — when false, save proceeds without parse. Example (CV): new file selected **and** employment section empty.

## Parallel save + parse

When gating passes, parse starts in parallel with document save. Upload failure is **blocking**; parse failure is **warning** (save succeeds, flash message on qualifications hub).

## Progress UX

`Section2SaveProgressPanel` shows in-save progress copy from policy config (not hardcoded in the hook). Navigate with `section2StatusMessage` flash per qualifications flow contract.

## CV kind (first shipped parser)

| Concern | Location |
|---------|----------|
| Page wiring | `src/pages/Section2AddCV.tsx` |
| Parse policy | `src/features/section2/cvDocumentParsePolicy.ts` |
| Client normalizer | `src/lib/documentParsers/cv.ts` |
| Client registry entry | `documentParserRegistry.cv` |
| API extraction | `api/_documentParser/kinds/cv/extraction.ts` |
| Prompt + schema | `api/_ai/prompts/cvEmployment.v1.ts`, `api/_ai/schemas/cvEmployment.v1.ts` |
| Apply draft | `replaceEmploymentExperiences` via `ApplicationContext` |
| Analytics | `cvParserAnalytics.ts` via the `src/lib/posthog.ts` barrel (CV event names preserved for GA) |

CV persist exception: after document save, call `uploadCV` / `removeCV` (app-scoped FK on `applications.cv_document_id`).

### Course-specific work-experience assessment

CV parsing remains responsible only for drafting editable employment rows. A separate
authenticated `POST /api/evaluate-work-experience` request assesses those sanitised rows
against the selected course's `work_experience` requirements after CV auto-fill and after
employment or course changes. Applicant and employer names are never sent to the model.

Duration is calculated deterministically in `@johncarroll/eligibility-rules`; the model
classifies relevance and, only when the course explicitly declares it, the exact
`qualifyingRoleCriteria`. The result is advisory, versioned, fingerprinted, and persisted in
`applications.work_experience_assessments`. A model or service failure returns `needs_review`
and never prevents submission. Employer letters use the upload layer but are not parsed in
this release.

## Tertiary transcript kind (parse + program evidence review)

Reuses `/api/evaluate-transcript-eligibility` as a single LLM call for field extraction plus app-side program requirement review — not a separate `documentParserRegistry` entry. Keep applicant-facing copy framed as **program evidence review**, not a final eligibility decision.

| Concern | Location |
|---------|----------|
| Page wiring | `src/pages/Section2AddTertiary.tsx` |
| Parse policy | `src/features/section2/tertiaryTranscriptParsePolicy.ts` |
| Save orchestration | `src/features/section2/useSection2TertiarySaveWithParse.ts` |
| Field mapper | `src/lib/eligibility/mapToTertiaryQualification.ts` |
| Apply draft | merge into `TertiaryQualification` via `mergeQualificationDraft` (fill-empty-only) |
| Evidence API | `api/evaluate-transcript-eligibility.ts` |
| Analytics | `tertiaryTranscriptParserAnalytics.ts` |

Gating: new transcript selected **and** qualification core fields empty → auto-fill; new transcript always runs evidence review. Upload failure is **blocking**; parse/review failure is **warning** (save succeeds, `insufficient_data` fallback).

The Applications proxy retries one transient eligibility-service response (`502`, `503`, or
`504`) before returning a typed upstream error. If both attempts fail, applicant copy must
describe the evidence service as temporarily unavailable; “try a clearer file” is reserved
for successful assessments that genuinely contain no draftable transcript fields.

## Approved entry points

For a new ordinary parser kind:

1. `api/_documentParser/kinds/{kind}/` + prompt/schema
2. `src/lib/documentParsers/{kind}.ts`
3. Extend `ParseableDocumentKind` + registry entry
4. `src/features/section2/{kind}DocumentParsePolicy.ts`
5. Page: `useSection2DocumentSaveWithParse(policy)` (1–5 lines)

Do **not** copy upload hooks, storage paths, or save orchestration per kind.

## Key Files

| File | Role |
|------|------|
| `src/features/section2/useSection2DocumentSaveWithParse.ts` | Generic save + optional parse orchestration |
| `src/features/section2/section2DocumentSave.ts` | Kind-generic document record save |
| `src/lib/documentParserClient.ts` | `requestParseDocument(file, kind)` |
| `src/lib/documentParserRegistry.ts` | Kind → client config |
| `api/_documentParser/*` | Shared auth, file policy, errors, Sentry |
| `api/evaluate-work-experience.ts` | Course-specific advisory assessment route |
| `src/features/application/hooks/useWorkExperienceAssessment.ts` | Fingerprint and reassessment orchestration |
| `src/lib/documentFilePolicy.ts` | Shared MIME/size constants (client) |
| `api/_shared/documentFilePolicy.ts` | Shared MIME/size constants (server) |

## Forbidden shortcuts

- Copying upload hooks, storage paths, attachment logic, or save orchestration per kind.
- Moving final program decisioning into transcript extraction.
- Treating transcript results as final admissions decisions.
- Expanding the transcript exception beyond course-context behaviour.

## Intentional mirrors

- Client parser registry metadata mirrors API route availability; registry and API
  tests protect the mapping.
- Transcript processing deliberately has specialized orchestration because it
  combines field drafting with course-specific evidence review. It must continue
  to reuse shared upload, attachment, and persistence owners.

## Required checks

- Parser client/registry: `documentParserClient.test.ts` and
  `documentParserRegistry.test.ts`.
- Shared API framework: relevant `api/_documentParser/*` and `api/_ai/*` tests.
- Section 2 parsing saves: `section2DocumentSave.test.ts` and the relevant save-hook tests.
- Transcript changes: eligibility context/contract tests and transcript fixtures.

## Related decisions

- [ADR-0003: Eligibility Ownership](../decisions/0003-eligibility-ownership.md)
- [ADR-0004: Service Contract Ownership](../decisions/0004-service-contract-ownership.md)
