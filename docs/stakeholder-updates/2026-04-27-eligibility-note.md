# Eligibility Check Project Update — 2026-04-27

## What shipped
- We scoped the new work as an **eligibility-check project stream** (not full admissions processing).
- We defined the core document set for matching:
  - transcript (required)
  - completion certificate (conditional)
  - CV (core evidence)
- We documented the end-to-end target flow: upload -> extract -> normalize -> evaluate -> explainable result.
- We established a doc-first operating model so every scope/contract/policy change is captured in markdown for continuity.

## What is next
1. Finalize canonical profile and eligibility output schema (`eligible`, `conditionally_eligible`, `ineligible`, `insufficient_data`).
2. Implement ingestion/extraction skeleton with confidence and missing-evidence fields.
3. Implement rules engine v1 with per-program reason codes and explanation payload.

## How to provide feedback
- Reply directly in the project channel with:
  1. any program-rule edge cases we should model first
  2. required wording/disclaimer for advisory eligibility
  3. preferred turnaround target for returning results after upload
- Feedback window: this sprint (through next planning checkpoint).

## See/play with it
- Live application shell: https://application-prototype.vercel.app
- Historical roadmap for this stream: `docs/archive/eligibility-check-roadmap.md`
- Note: no standalone eligibility backend demo endpoint is live yet; this update reflects planning and architecture baseline.
