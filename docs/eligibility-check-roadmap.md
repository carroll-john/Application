# Eligibility Check Roadmap

## Objective
Build a backend-backed eligibility-check flow where users can upload:
- course transcript (required)
- certificate of completion (conditionally required)
- CV (required unless future policy changes)

The system should extract and parse document data, evaluate program rules, and return postgraduate programs the user is eligible to enroll in with transparent rationale.

## Product Boundary (Current)
- This is an eligibility recommendation flow, not a full admissions processing system.
- Output is advisory and should explain confidence and missing evidence.
- Final admissions decisions remain out of scope.

## Canonical Flow
1. User uploads transcript, optional certificate, and CV.
2. System stores files and metadata.
3. Extraction pipeline reads document contents.
4. Normalization builds a canonical applicant profile.
5. Rules engine evaluates each postgraduate program.
6. User sees:
   - eligible programs
   - conditionally eligible programs
   - ineligible programs
   - reasons, missing requirements, and next steps

## Service Architecture (Target)
- **Ingestion service**: upload lifecycle, storage metadata, file validation.
- **Extraction service**: OCR/text parsing, field extraction, confidence scoring.
- **Profile normalizer**: maps raw extraction to canonical profile fields.
- **Eligibility engine**: deterministic rules evaluation by program.
- **Results API**: serves explainable eligibility outcomes to frontend.

## Data Contracts (Draft V1)
### Input documents
- `transcript`
- `completion_certificate` (optional)
- `cv`

### Canonical profile fields
- `educationRecords[]`
- `completionEvidence`
- `experienceSummary`
- `extractedSkills[]`
- `confidenceByField`
- `missingEvidence[]`

### Eligibility output
- `programId`
- `status` (`eligible` | `conditionally_eligible` | `ineligible` | `insufficient_data`)
- `reasonCodes[]`
- `missingRequirements[]`
- `confidence`
- `rulesVersion`
- `profileVersion`

## Iteration Protocol
When making changes, update docs in this order:
1. `docs/decisions.md` (what was decided and why)
2. `docs/eligibility-check-roadmap.md` (what changes in scope/architecture/contracts)
3. `docs/current-phase.md` (what is now active and next)
4. `docs/project-memory.md` only if durable constraints changed
5. `docs/stakeholder-updates/YYYY-MM-DD-eligibility-note.md` for business-facing progress comms

Each implementation PR should include a short "Docs updated" checklist in its description:
- [ ] decision entry added/updated
- [ ] roadmap section updated
- [ ] phase tasks updated
- [ ] durable memory updated (if needed)
- [ ] stakeholder update note added/refreshed

## Stakeholder Comms Format
Use this fixed structure so updates are easy to paste into Notion and chat:
- **What shipped** (plain-English outcomes)
- **What is next** (next 1-3 milestones with dates if known)
- **How to give feedback** (single inbox/channel + deadline)
- **See/play with it** (link to environment, prototype, or API collection)

If no playable build exists yet, say so explicitly and provide the nearest artifact (prototype link, API mock, or screenshot).
Notion publishing automation should live in the dedicated eligibility backend repository so this prototype repo stays focused on applicant UX.

## Near-Term Build Plan
### Phase 1: Foundations
- Define canonical profile contract and rules schema.
- Implement upload metadata + secure document storage.
- Add extraction stubs with mocked outputs for frontend integration.

### Phase 2: Parsing + Rules
- Implement transcript/certificate/CV extraction pipeline.
- Add normalization layer with confidence scoring.
- Build rules engine and explanation payloads per program.

### Phase 3: Trust + Scale
- Add user correction/override loop for extracted fields.
- Add re-run eligibility and rules/profile version tracking.
- Add monitoring for extraction failures and low-confidence patterns.

## Risks To Track
- Parsing quality variance across transcript layouts.
- Rule drift between policy and implementation.
- Over-automation without clear "insufficient data" fallback path.
- Missing explainability causing low user trust.
