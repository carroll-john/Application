# OSCA Occupation Matcher — Design Specification

Dated 2026-09-25. Companion to
[2026-09-11-production-build-estimate.md](2026-09-11-production-build-estimate.md),
which ranked "occupation classification has no reference dataset" as gap 1.

**Status: proposal, not a ratified decision.** If adopted, promote the closed-set
contract in §4 to an ADR under `docs/decisions/` and amend
[docs/domains/document-parsing.md](../domains/document-parsing.md). Until then this
file is a dated design assessment and not current guidance.

---

## 1. Why this is the first decision-layer component to build

Occupation classification is not a labelling nicety. It is load-bearing for an
admission outcome, and it currently runs on model recall.

Three facts from the code, in the order they compound:

**The model is asked to remember the classification.**
`api/_ai/prompts/cvRecognition.v2.ts` lines 13–18 instruct the extractor to
"identify the best matching … OSCA occupation" and "return the OSCA occupation
code, occupation title and skill level 1 to 5". No occupation list, index or
lookup table exists anywhere in the repository. The model is recalling six-digit
codes from training data.

**Nothing downstream checks the code.**
`oscaOccupationCode` is typed `{ type: "string" }` in
`api/_ai/schemas/cvRecognition.v2.ts` and `string` in `src/lib/ucRplAssessment.ts`.
Tracing every non-test reference — `parse-cv.ts:96`, `documentParserRegistry.ts:133`,
`ucRplAssessment.ts:475,511,524` — the value is never validated for membership in a
classification, and never validated for format. A plausible-looking wrong code is
indistinguishable from a right one at every layer.

**The skill level sets the admission band.**
`ucRplAssessment.ts:450`:

```ts
function admissionBand(skillLevel: OscaSkillLevel | null, months: number) {
  if (skillLevel === 1) {
    if (months >= 36) return 5 as const;
    if (months >= 12) return 4 as const;
  }
  if (skillLevel === 2) {
    if (months >= 60) return 5 as const;
    if (months >= 24) return 4 as const;
  }
  return null;
}
```

A skill level of 1 or 2 produces an equivalent GPA of 4.0 or 5.0 and a
`may_meet` status. A skill level of 3 produces `null` and no admission signal.
One recalled digit is the difference between an applicant being told they may
meet entry requirements and being told nothing.

The code compounds it a second way. `assessUcAdmission` groups roles by
`normalizeKey(oscaOccupationCode) || normalizeKey(oscaOccupationTitle)` before
computing `unionMonths`. A code that is wrong in a *consistent* way merges two
unrelated roles into one duration total; a code that is wrong *inconsistently*
splits one continuous occupation into two short ones that each fall under the
12-month floor. Both change the band. Neither is visible to anyone.

So the failure mode is not "the classification is a bit rough". It is: an
unrecorded, unvalidated, model-recalled integer silently determines an admission
signal, and there is no artefact anyone can audit afterwards.

Everything below exists to make one class of error structurally impossible: the
system must never emit an occupation code that does not exist in a versioned
reference list, and must never emit a skill level the model chose.

---

## 2. Sourcing the reference data

### 2.1 What to take

The classification is **OSCA — Occupation Standard Classification for Australia,
2024, Version 1.0**, published by the ABS on 6 December 2024, superseding ANZSCO.

Verified structure:

| Level | Digits | Note |
|---|---|---|
| Major group | 1 | formed from skill level + broad skill specialisation |
| Sub-major group | 2 | |
| Minor group | 3 | |
| Unit group | 4 | |
| **Occupation** | **6** | the classification leaf — **1,156 of them** |

Five skill levels (1 highest to 5 lowest) are assigned within the hierarchy.

The ABS publishes, under Data downloads for the 2024 v1.0 release:

- a spreadsheet of **all OSCA categories and their descriptions** (added
  28 July 2025) — this is the primary input;
- **correspondence tables** to ANZSCO, ISCO-08 and NOL — needed for §7.2;
- an **OSCA Coder** tool, published separately.

Two things an engineer must confirm at build time rather than assume, because
this document could not reach `abs.gov.au` from the build network to verify them:

1. **The licence and attribution terms on the specific download files.** ABS
   material is generally released under a Creative Commons attribution licence,
   but confirm it on the file itself and record the exact terms in the generator
   header. Redistribution inside a commercial product needs this settled before
   the index is committed, not after.
2. **Whether v1.0 is still current.** The classification is versioned and the ABS
   has already shipped supplementary files post-release. The build must pin a
   version, not track "latest".

Egress to `abs.gov.au` will also need allowing on the build network.

### 2.2 What to build from it

One committed artefact, `src/lib/osca/osca.index.generated.json`, following the
pattern already established by `requirements.generated.json`: a generator script,
a committed JSON output, a loader, and an eval harness that scores the committed
output.

Row shape, one per occupation:

```json
{
  "code": "121131",
  "title": "Chief Executive Officer",
  "skillLevel": 1,
  "ancestry": {
    "majorGroup":    { "code": "1", "title": "Managers" },
    "subMajorGroup": { "code": "12", "title": "..." },
    "minorGroup":    { "code": "121", "title": "..." },
    "unitGroup":     { "code": "1211", "title": "..." }
  },
  "description": "…ABS category description…",
  "tasks": ["…", "…"],
  "alternativeTitles": ["Managing Director", "…"],
  "specialisations": ["…"],
  "anzscoCorrespondence": [{ "code": "111111", "relationship": "one-to-one" }]
}
```

`alternativeTitles` and `specialisations` matter more than the description for
retrieval quality — they are how applicants actually name their jobs. Do not drop
them to save bytes.

Frozen metadata, checked by the loader on every boot:

```json
"meta": {
  "classification": "OSCA",
  "sourceVersion": "2024 v1.0",
  "sourceFiles": [{ "name": "...", "sha256": "..." }],
  "indexVersion": 1,
  "generatedAt": "2026-…",
  "occupationCount": 1156
}
```

The loader must fail closed if `occupationCount` disagrees with the row count or
a source hash is missing. A silently truncated index degrades into exactly the
recall failure this whole design exists to prevent, and it would look like a
model quality problem.

### 2.3 A note on scale

1,156 rows is small. The entire index is a few megabytes; embeddings at 512
dimensions are roughly 2.4 MB as float32. Brute-force cosine similarity over an
in-memory `Float32Array` of that size is sub-millisecond.

**Do not provision a vector database for this.** The pgvector reflex would add an
operational dependency, a migration, and a network hop to a problem that fits in
a serverless function's memory with room to spare. Revisit only if the index
grows by an order of magnitude — which, for a national occupation
classification, it will not.

---

## 3. Pipeline shape

Two stages, replacing one. Extraction stops classifying.

```
CV ──▶ [1] EXTRACT  (LLM, once per document)
           └─▶ roles: position, duties, employer, type, dates
                         │
                         ▼  once per role
       [2] MATCH
           ├─ 2a RETRIEVE   deterministic, no network, no model
           │      BM25 + embedding kNN ──▶ RRF ──▶ top 20 candidates
           │
           ├─ 2b RERANK     LLM picks an ordinal from the 20, or abstains
           │
           └─ 2c RESOLVE    ordinal ──▶ index row (authoritative code/level)
                         │
                         ▼
                   evidence record
```

The LLM appears exactly twice per document: once to read it, once per role to
choose among candidates it was handed. It never originates a code, a title, or a
skill level. Everything after 2c is deterministic and replayable.

---

## 4. The closed-set contract

This is the core of the design and the part to hold the line on under schedule
pressure.

> **The reranker returns an ordinal into a candidate list it was given. It never
> emits an occupation code, an occupation title, or a skill level. Those three
> fields are read from the index row that the ordinal resolves to, server-side,
> after validation.**

Hallucinated codes become structurally impossible rather than statistically
unlikely — the model has no channel through which to express one. Contrast the
current design, where the code *is* the model's output and correctness is a hope.

### 4.1 Retrieval (2a)

Deterministic, pure, no network. Runs in CI on every pull request for free.

**Query composition.** Not the job title. The existing prompt is already right
that "the work actually performed" governs, and the retriever must honour that.
Run two passes and fuse them:

- pass A: `position` + `employmentType`
- pass B: `duties`

Fusing two focused queries beats one concatenated query, because a long duties
paragraph otherwise swamps a short precise title, and a title like "Associate
Director" otherwise swamps the duties that disambiguate it. Test both; the
two-pass version is the starting hypothesis, not a certainty.

**Two retrievers, because neither suffices:**

- **BM25** over `title + alternativeTitles + specialisations + tasks`. Catches
  exact occupational nouns — *boilermaker*, *actuary*, *anaesthetist* — where
  embeddings drift to semantic neighbours.
- **Embedding kNN** over a composed document per occupation
  (`title. alternativeTitles. description. tasks.`). Catches duty-described roles
  where the title is absent, invented, or misleading — "reconciled the general
  ledger and prepared statutory accounts" with the title "Business Partner".

**Fusion: Reciprocal Rank Fusion**, `score = Σ 1/(k + rank_i)`, k = 60. RRF
consumes ranks, not scores, which sidesteps the usual hybrid-search failure of
trying to normalise a BM25 score against a cosine similarity. It needs no tuning
and no training data — both of which you lack on day one.

**Output:** top 20 candidates. Twenty is chosen so recall@20 can realistically
clear 0.95 while the rerank prompt stays small enough to be cheap and to avoid
lost-in-the-middle degradation. Measure recall@k at 10/20/50 on the eval set and
re-set it from evidence.

**Retrieval-side abstain.** If the top fused candidate falls below a score floor,
return zero candidates and abstain without calling the reranker. Rerankers forced
to choose from twenty irrelevant options will pick the least-bad one and describe
it confidently. Not calling the model is both cheaper and more honest.

### 4.2 Rerank (2b)

The model sees the role and a numbered list. Each candidate shows ordinal, title,
skill level, unit-group title, and a one-line task summary — enough to
discriminate, short enough that twenty fit comfortably.

Response schema, and nothing else:

```json
{
  "selection":  3,          // ordinal in [1,20], or null to abstain
  "runnerUp":   7,          // ordinal or null — the next-best defensible match
  "confidence": "high",     // high | medium | low
  "rationale":  "Duties describe…"   // must cite evidenced duties
}
```

`runnerUp` is not decoration. It is the ambiguity signal that §4.3 turns into a
safety rule.

Prompt rules worth stating explicitly, because each maps to an observed failure
mode:

- Classify the work performed and the level of responsibility, not the title.
  (Carry this over from the existing prompt; it is the one part worth keeping.)
- Seniority words in a title do not move the skill level on their own.
- Abstain rather than choose a poor fit. Abstention is a correct answer and is
  scored as one.
- The rationale must quote evidenced duties and must not assert an admission or
  credit outcome.

### 4.3 Resolve and validate (2c)

Server-side, deterministic, no model involvement:

1. `selection` must be an integer in `[1, candidates.length]`. Anything else —
   out of range, non-integer, a string, a code — is an **abstain**, logged as a
   protocol violation. This is the hard boundary.
2. Resolve the ordinal to the candidate's index row. Take `code`, `title`,
   `skillLevel`, `ancestry` **from the row**. Discard anything else the model
   said about them.
3. **Skill-level ambiguity downgrade.** If `runnerUp` is present and
   `row[runnerUp].skillLevel !== row[selection].skillLevel`, force `confidence`
   to at most `medium` and set an assessor-review flag.

Rule 3 is the one that ties this component to the actual harm. A tie between two
candidates inside the same skill level cannot change `admissionBand` — the
applicant sees the same equivalent GPA either way, so the ambiguity is cosmetic.
A tie *across* a skill-level boundary changes the admission signal. Only the
second kind needs a human, and this rule routes exactly that kind and no more.

---

## 5. Output contract

The matcher emits an evidence record, not a mutated extraction row:

```json
{
  "roleId": "…",
  "classification": "OSCA",
  "sourceVersion": "2024 v1.0",
  "indexVersion": 1,
  "code": "121131",
  "title": "Chief Executive Officer",
  "skillLevel": 1,
  "unitGroup": "1211",
  "confidence": "high",
  "rationale": "…",
  "abstained": false,
  "requiresAssessorReview": false,
  "provenance": {
    "retrieval": { "candidateCodes": ["121131","121332", "…"], "selectedRank": 1 },
    "model": "…", "promptId": "osca-rerank", "promptVersion": 1,
    "matchedAt": "2026-…"
  },
  "override": null
}
```

`provenance.candidateCodes` and `selectedRank` are what make a decision
reproducible a year later when someone asks why an applicant was told they may
meet entry requirements. Without them the matcher is as unauditable as the
current prompt, however good its accuracy.

`override` carries assessor corrections. A correction must never overwrite the
machine result — it supersedes it, and both persist. Corrections are also the
highest-quality eval data the system will ever produce; §7.2 depends on capturing
them from day one.

---

## 6. Confidence must be calibrated, not asserted

Downstream code already gates on `oscaConfidence`. If the label is vibes, that
gate is decoration.

Define it measurably and hold it to the definition:

| Label | Contract |
|---|---|
| `high` | ≥ 95% of `high` predictions are correct at skill level on the eval set |
| `medium` | 80–95%; shown to the applicant as provisional |
| `low` | below 80%; routed to an assessor, never used to produce a band |

Publish the measured rates alongside the eval run. When observed `high` accuracy
falls below its contract, the fix is to retune or re-prompt — not to relabel the
threshold. Record the measured numbers in the eval output so drift is visible in
a diff rather than discovered by a complaint.

---

## 7. The eval set

This section decides whether any of the above works. Build the eval set before
the matcher, not after.

### 7.1 Shape

One fixture per **role**, not per CV. Roles are the unit of classification, and
CV-level fixtures hide which role failed.

```json
{
  "id": "role-0042",
  "input": {
    "position": "Business Partner",
    "employmentType": "Full-time",
    "employer": "…",
    "duties": "Reconciled the general ledger, prepared statutory accounts…",
    "startYear": 2019, "endYear": 2023
  },
  "gold": { "code": "221111", "skillLevel": 1 },
  "acceptable": [{ "code": "221213", "note": "defensible as management accountant" }],
  "tier": "ambiguous",
  "provenance": "two-coder adjudicated, 2026-…"
}
```

`acceptable` is not a convenience. Occupational coding has genuine, legitimate
ambiguity, and scoring against a single gold code produces an accuracy number
that mostly measures how often the model agreed with one coder's judgement call.
A prediction in `acceptable` scores as correct for top-1 and is reported
separately.

Stratify across all major groups and all five skill levels, then
deliberately **over-weight the skill level 1 / level 2 boundary**. That boundary
is where `admissionBand` changes its output. Levels 3 to 5 all return `null` and
produce no admission signal, so a level 3/level 4 confusion is currently
harmless. Concentrate eval effort where an error changes a decision; revisit if
the matrix ever extends to lower levels.

Include a deliberate adversarial tier: inflated titles ("Chief Happiness
Officer"), military and public-sector titles with no civilian analogue, trades
described only by duties, roles spanning two occupations, and non-occupational
entries such as volunteering or study.

### 7.2 Where gold labels come from

Honestly: this needs human occupational coders, and it is a content operation,
not an engineering one — the same distinction §6.1 of the build estimate drew for
rule authoring. Budget it in SME-hours.

In order of yield:

1. **Bootstrap from the ANZSCO correspondence.** Any existing ANZSCO-coded
   employment data can be mapped through the ABS correspondence file to OSCA.
   Keep only the one-to-one correspondences automatically; route split and merge
   correspondences to a human. This is the cheapest route to a few hundred
   defensible labels and should be tried first.
2. **The ABS OSCA Coder as a second opinion.** Useful for bootstrapping and for
   flagging disagreement. Not gold on its own, and check its terms of use before
   automating against it.
3. **Two independent human coders plus adjudication** for a core set.

Measure **inter-annotator agreement** (Cohen's κ) on the core set before trusting
any of it. If two competent coders disagree materially, the failure is in the
task definition or the duty descriptions, and no model will fix it. A low κ is a
finding about the product, discovered for the price of a few SME-days rather than
after launch.

Size: **150–250 roles** to start. Enough to separate a working system from a
broken one and to calibrate confidence; small enough to label properly. Grow it
from real assessor overrides (§5) once the flow is live — that stream is the
cheapest high-quality labelled data the system will ever get, which is why
override capture belongs in v1 and not in a later phase.

### 7.3 Metrics

| Metric | What it tells you |
|---|---|
| **Recall@20** (retriever) | Hard ceiling on everything downstream. If gold is not in the candidates, no reranker can recover. |
| Top-1 exact code | Headline accuracy. |
| Top-1 unit group (4-digit) | Partial credit; distinguishes "wrong neighbourhood" from "near miss". |
| **Skill-level accuracy** | The field that drives the band. |
| **Band accuracy** | Run `admissionBand()` on predicted vs gold and compare the resulting GPA. |
| Abstain precision / recall | Is abstention used when it should be, and only then? |
| Over-confidence rate | Share of `high` predictions that are wrong. |

**Band accuracy is the metric that matters.** It is the only one that measures
harm to an applicant. A system at 82% exact-code accuracy whose errors all stay
inside a skill level is materially better than one at 88% whose errors cross the
1/2 boundary. Report exact-code accuracy, but gate on band accuracy.

Proposed initial gates — starting positions to be re-set from the first baseline,
not derived numbers:

- recall@20 ≥ 0.95
- skill-level accuracy ≥ 0.90
- band accuracy ≥ 0.95
- over-confidence rate ≤ 0.02

### 7.4 CI

Split the eval so the cheap half always gates:

- **`osca:eval-retrieval`** — hermetic, no network, no API key, deterministic.
  Scores recall@k for the committed index against the fixtures. **Runs on every
  pull request and blocks merge.**
- **`osca:eval`** — full pipeline including the reranker. Runs nightly and on
  changes to the prompt, schema, index or matcher paths. Blocks merge on those
  paths.

This is deliberate. The existing LLM regression job only fires when an OpenAI
secret is present *and* specific paths change, which is why the build estimate
counted it as partial coverage. Retrieval quality needs no secret, so there is no
reason for it not to gate everything, every time.

Commit the eval output as a scored report, not a pass/fail bit. Fixtures must
also never be byte-identical to generated output — the existing course
requirements corpus has all fifteen fixtures identical to the output they check,
which detects drift but cannot detect wrongness. Gold labels here come from
humans and the correspondence file, never from a run of the matcher.

---

## 8. Repository shape

Mirrors the existing `parse-course-requirements` → `requirements.generated.json`
→ `requirementsLoader` → `parse-eval` pattern.

```
scripts/build-osca-index.ts          generator; pins source version + hashes
scripts/osca-eval.ts                 full eval
scripts/osca-eval-retrieval.ts       hermetic retrieval-only eval

src/lib/osca/osca.index.generated.json
src/lib/osca/osca.embeddings.generated.bin    float32, 512-dim
src/lib/osca/index.ts                loader; fails closed on hash/count mismatch
src/lib/osca/retrieve.ts             BM25 + cosine + RRF; pure
src/lib/osca/resolve.ts              ordinal → row; validation gate (§4.3)

api/_ai/prompts/oscaRerank.v1.ts
api/_ai/schemas/oscaRerank.v1.ts
api/_documentParser/kinds/cv/oscaMatch.ts     orchestration

tests/fixtures/osca/manifest.json
tests/fixtures/osca/roles/*.json
```

npm scripts: `osca:build-index`, `osca:eval`, `osca:eval-retrieval`.

## 9. Changes to existing code

| File | Change |
|---|---|
| `api/_ai/prompts/cvRecognition.v2.ts` | Delete the OSCA mapping rules, lines 13–18. Extraction stops classifying. |
| `api/_ai/schemas/cvRecognition.v2.ts` | Drop the five `osca*` properties and their `required` entries. Bump the prompt version. |
| `api/parse-cv.ts` (~line 96) | Stop reading `osca*` from recognition; call the matcher as stage 2. |
| `src/lib/documentParserRegistry.ts` (~line 133) | Read `osca*` from the matcher's evidence record, not the recognition payload. |
| `src/lib/ucRplAssessment.ts:475` | Group by validated code only. Drop the `oscaOccupationTitle` fallback — grouping admission duration on free text is how one occupation silently becomes two. Roles that abstained group as ungrouped and contribute no band. |
| `api/_documentParser/kinds/cv/billShortenDemoOscaMatches.ts` | Move behind a demo flag off the production path; promote its seven fixed role matches into eval fixtures, where hand-set expected values belong. |

The schema change is the irreversible one — once extraction stops emitting
`osca*`, the matcher must be in place. Sequence accordingly (§10).

## 10. Sequence and effort

Run it in this order; each step is independently useful and the early steps are
the cheap ones that de-risk the rest.

| # | Step | Engineer-weeks | SME-weeks |
|---|---|---|---|
| 1 | Source, licence check, index generator, loader | 2–3 | — |
| 2 | Eval set v1: bootstrap from ANZSCO correspondence, adjudicate core, measure κ | 2–3 | 3–6 |
| 3 | Retrieval + RRF + hermetic retrieval eval in CI | 2–3 | — |
| 4 | Rerank service, closed-set validation, abstain | 2–3 | — |
| 5 | Calibration, thresholds, full eval in CI | 1–2 | — |
| 6 | Integration; remove OSCA from extraction; override capture | 2–3 | — |
| | **Total** | **11–17** | **3–6** |

Steps 1–3 answer the question that decides the rest: **what is recall@20?** If a
deterministic retriever cannot get the right occupation into twenty candidates
for 95% of roles, no amount of reranking will save it, and the problem is the
duty descriptions or the task definition rather than the model. That is roughly
six engineer-weeks to find out, before committing to the remainder.

This sits inside Track A1 (decision services, 60–90 engineer-weeks) from the
build estimate rather than adding to it. The 3–6 SME-weeks are new and belong in
the same content-operations budget as rule authoring — they do not compress by
adding engineers.

---

## 11. What this deliberately does not do

- **No fine-tuning.** Retrieval plus a closed-set reranker over 1,156 options
  with 150–250 eval examples is not a fine-tuning problem. Revisit only if
  calibrated accuracy plateaus below the gates with a healthy recall@20.
- **No vector database.** §2.3.
- **No automatic reclassification on version change.** When the ABS ships OSCA
  2027, existing evidence records keep their `sourceVersion` and are migrated
  deliberately through the correspondence file, with the migration recorded.
  Silently recoding historical admission evidence would destroy the audit trail
  this design exists to create.
- **No extension to credit or RPL decisions.** This component answers "which
  occupation is this role" and stops. What that occupation entitles an applicant
  to is a rules question, owned by the Applications repository under guardrail 6.

---

Sources for the OSCA structure facts in §2.1:
[OSCA structure](https://www.abs.gov.au/statistics/classifications/osca-occupation-standard-classification-australia/2024-version-1-0/osca-structure),
[OSCA 2024 v1.0](https://www.abs.gov.au/statistics/classifications/osca-occupation-standard-classification-australia/2024-version-1-0/osca-2024-v10),
[Data downloads](https://www.abs.gov.au/statistics/classifications/osca-occupation-standard-classification-australia/2024-version-1-0/data-downloads),
[OSCA Coder](https://www.abs.gov.au/statistics/classifications/occupation-standard-classification-australia-osca-coder/latest-release).
Licence terms and currency of v1.0 were not verifiable from the build network and
are flagged in §2.1 as build-time checks.
