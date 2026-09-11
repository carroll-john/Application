# Production Build Estimate — Applications Platform

> **Dated assessment.** Records the codebase as observed on 2026-09-11 at commit
> `3f34ba7`. It is not current implementation guidance. See
> [`../system-context.md`](../system-context.md) for current ownership and boundaries.

Review date: 2026-09-11
Purpose: size the work required to take this prototype to a production university
admissions platform, identify the target architecture, and state the skills needed.

---

## 1. Summary

Two findings, and the second displaced the first.

**The applicant journey is substantially built and engineered well above prototype
standard.** Multi-step application capture, authentication with enforced MFA,
server-authoritative submission, private document handling, 832 test cases and a
documented architecture with contract-tested boundaries.

**The decision layer is not built, though it looks like it is.** Occupation
classification has no reference dataset and asks a language model to recall
codes from memory. Admission and credit decisions execute in the applicant's
browser and are never recorded. There is no canonical evidence model, no credit
precedent concept, and entry requirements are LLM-generated JSON compiled into
the bundle. This is the part of the product that differentiates it, and it is
closer to a working demonstration than to a system that can issue outcomes.

The institution-facing half — assessment, decisions, offers, student-system
integration — does not exist at all.

| Half of the product | State |
| --- | --- |
| Applicant capture (discover → apply → submit) | Substantially built |
| Decision layer (extract → classify → decide) | Demonstrated, not built |
| Institution experience (assess → decide → offer → enrol) | Absent |

This remains a **harden and extend** estimate. Nothing found argues for starting
again — the foundations, the rule format and the domain modelling are sound.

### Effort and cost

| Track | Scope | Engineer-weeks | All-in cost (AUD ex GST, contract basis) | Calendar |
| --- | --- | --- | --- | --- |
| **A** | Production-grade decision layer, plus hardening the applicant journey | 97–144 | $820k – $1.66m | 6–9 months, team of 5–6 |
| **A + B** | Add admissions staff portal, offer lifecycle, SIS integration, payments | 150–221 | $1.27m – $2.54m | 12–16 months, team of 7–8 |
| **A + B + C** | Multi-institution platform, agent portal, international cohort | 184–270 | $1.55m – $3.11m | 18–24 months, team of 8–10 |

All-in figures apply a 30% loading for non-engineering delivery and 18%
contingency. Section 8 prices the same effort against in-house and consultancy
rates.

> **Track A grew from an earlier figure of 53–77.** That earlier number treated
> the intelligence layer as existing and needing governance wrapped around it.
> On inspection, occupation grounding, server-side decisions and credit
> precedent are builds, not hardening jobs. Section 7 reconciles the change line
> by line. The applicant-facing application API, sized separately at 8–12 weeks
> during the review, is excluded because it has since been built.

---

## 2. What exists

Roughly 695 files: ~38,500 lines of production TypeScript/TSX in `src`, ~8,400 in
`api`, ~6,100 lines of SQL migrations, ~3,800 in the in-repo rules package, and
~20,000 lines of test code across 131 test files and 832 test cases.

### 2.1 Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript 6 (strict), Vite 8, Tailwind CSS 4, React Router 7, `react-datepicker`, `date-fns`, `lucide-react` |
| Design system | Code-based — `src/index.css` tokens plus `src/components/ui/*`; brand selected at build time via `VITE_APP_BRAND` |
| API | Vercel serverless functions, Node ESM, Web Fetch handlers |
| Data | Supabase — Postgres 17, Auth with email/password and TOTP MFA, private Storage bucket, Row Level Security |
| AI | OpenAI `gpt-4.1-mini` through versioned prompts and JSON output schemas |
| Rules engine | `vendor/eligibility-rules`, an in-repo TypeScript package shared by app, API proxy and offline tooling |
| Observability | Sentry (browser + server, AI spans, session replay) and PostHog (typed event catalogue) |
| Email | Resend, as custom SMTP behind Supabase Auth |
| Hosting | Vercel, Supabase Cloud, Render (two extracted services) |
| CI | Four GitHub Actions workflows plus a one-way Azure Pipelines mirror |

### 2.2 Applicant-facing features

1. **Course discovery** — browse, filters, results, cards, detail with hero and
   checklist. Two committed catalogues: 34 StudyNext and 33 UC courses.
2. **Pre-application eligibility check** — modal, result modal, per-course
   evidence display.
3. **Authentication** — sign up, sign in, email confirmation, forgot and reset
   password, TOTP MFA enrolment and challenge enforced to AAL2, password change
   with re-authentication, leaked-password check.
4. **Applicant profile** and a multi-application dashboard.
5. **Section 1 (personal), six steps** — basic info, contact, personal contact,
   address with Places autocomplete, cultural background, family support and
   disability.
6. **Section 2 (qualifications), hub plus six record types** — secondary and
   tertiary (with transcript), CV, employment, language test, accreditation;
   supporting-evidence panel, evidence plan, next-step panel, dispute form.
7. **Review and submit** — section summaries, validation panel, declaration,
   server-authoritative submit with a database-owned policy snapshot.
8. **UC credit / RPL demonstration** — course matcher, experience review, credit
   comparison panel.
9. **Shared UI kit** — form primitives, three autocompletes, date controls, modal
   shell, upload fields, brand chrome, loading and error states.

### 2.3 Serverless API surface

| Endpoint | Responsibility |
| --- | --- |
| `POST /api/parse-cv` | CV to structured employment history via OpenAI |
| `POST /api/evaluate-transcript-eligibility` | Transcript to evidence, proxied to `eligibility-service`, local OpenAI fallback |
| `POST /api/evaluate-work-experience` | Work experience to RPL / credit assessment |
| `GET /api/document-delivery` | Signed delivery of privately stored documents |
| `POST /api/capture-eligibility-feedback` | Applicant dispute capture |
| `POST /api/capture-auth-sign-up-succeeded` | Server-side sign-up analytics |
| `POST /api/check-leaked-password` | k-anonymity breach check |
| `POST /api/csp-report` | CSP violation collector |
| `GET /api/suggest/addresses`, `/institutions` | Proxy to `suggest-service` |

Backed by shared modules for LLM invocation and tracing (five versioned prompts,
five output schemas), document parsing, eligibility, suggestions, rate limiting,
Sentry and PostHog.

### 2.4 Data layer

- **11 tables** — `applications`, `application_documents`, `applicant_profiles`,
  `business_users`, `tertiary_qualifications`, `secondary_qualifications`,
  `employment_experiences`, `language_tests`, `professional_accreditations`,
  `course_submission_policies`, `allowed_email_domains`.
- **~25 functions**, including the `submit_application` RPC and a `private`
  schema of upload-limit, storage-integrity and MFA-enforcement helpers.
- **35 RLS policies** across 30 migrations, including AAL2 enforcement for
  MFA-enrolled users.
- **Private storage bucket** with size and MIME limits at both bucket and trigger
  level, and a SQL test suite for MFA and submission authority.

### 2.5 External services

| Service | Type | Responsibility |
| --- | --- | --- |
| Supabase | Runtime | Auth, Postgres, Storage, RLS, submit RPC |
| `eligibility-service` (Render) | Runtime, separate repo | Transcript evidence extraction |
| `suggest-service` (Render) | Runtime, separate repo | Institution index and Google Places addresses |
| OpenAI | Runtime | Reached only through server-side routes |
| Sentry, PostHog | Runtime, fail-open | Monitoring and product analytics |
| Resend | Runtime | Transactional auth email via Supabase SMTP |
| Have I Been Pwned | Runtime | Leaked-password check |

---

## 3. Quality assessment

### 3.1 Genuine strengths

These are why this is an extend-and-harden job rather than a rewrite.

- **Type discipline.** Strict mode, zero `: any` in production code, three TODO
  markers in the entire non-test codebase.
- **Test depth.** 832 cases, ~20,000 lines of test code, contract tests
  protecting every declared duplication between TypeScript and SQL.
- **Architecture governance.** An authoritative ownership map, seven ADRs, a
  forbidden-shortcut list, and a machine-validated documentation contract.
- **Server-authoritative submission.** The client is explicitly a UX mirror; the
  RPC and a database-owned policy snapshot are final authority; submitted
  records are immutable to applicants.
- **Security posture well beyond prototype level.** Enforced CSP with reporting,
  HSTS, TOTP MFA enforced in both browser and RLS via the JWT `aal` claim,
  per-route rate limiting, database and storage upload quotas, anon-role grants
  revoked, pg_graphql exposure disabled.
- **A well-designed rule format.** See section 4.3 — this is the single most
  valuable artefact in the repository and it needs promoting, not redesigning.

### 3.2 What is weaker than it appears

- **End-to-end testing is non-gating.** A 1,176-line Playwright synthetic-funnel
  bot does drive a real authenticated journey through review and submission, but
  it is `workflow_dispatch`-only against a deployed preview and contains 110
  `.catch(() => {})` swallows with zero assertions. Eleven component tests use
  `renderToStaticMarkup`, so no interaction is exercised in CI. Useful
  scaffolding; nothing that can fail a build.
- **The AI quality gate is narrow, not standing.** The temporary pause in
  `ci.yml` expired on 2026-07-24 and the job runs automatically again — but only
  when the OpenAI secret is present *and* CV or transcript paths change, so
  accuracy is never measured on a standing basis. `docs/workflows/ci.md` still
  describes it as paused.
- **Rate limiting is in-memory.** Limits reset on every cold start and are
  per-instance, not global.

### 3.3 Delivery risks

- **Bus factor of one.** Fifty-nine of sixty commits are by a single author
  working with AI assistance. Onboarding is budgeted explicitly in Track A.
- **Cross-repo contract drift.** Two runtime dependencies deploy independently;
  contract tests exist on the caller side only.
- **Rules correctness is unvalidated against real policy.** The engine is well
  tested against its own fixtures. No admissions authority has signed it off.

---

## 4. Target architecture

### 4.1 One pipeline, two document kinds

Every capability in scope — eligibility, CV auto-fill, occupation mapping, course
matching, credit and RPL — is a composition of three operations with opposite
engineering characteristics:

| Operation | Speed | Nature | On failure | Wants |
| --- | --- | --- | --- | --- |
| **Extract** — document to raw facts | Seconds to a minute | Probabilistic | Degrade to manual entry | Jobs, retries, provider swap |
| **Classify** — free text to controlled vocabulary | Sub-second | Grounded in a dataset | Return candidates, not a guess | Reference data, eval sets |
| **Decide** — facts plus rules to an outcome | Milliseconds | Deterministic | Never silently; refer to a human | Recording, replay, reason codes |

The load-bearing property: **language-model calls happen twice — once per
document, once per role — and never again.** Everything downstream is
deterministic evaluation over structured data. That is what makes "which of
several hundred programs is this person eligible for" a millisecond sweep rather
than a fan-out of hundreds of model calls, and it is the practical reason the
three operations must be separate services rather than one fused route.

CVs and transcripts run the same pipeline, parameterised by document kind.

### 4.2 Evidence is the spine, and trust tiers are not optional

Extraction and decision currently hand data to each other as ad-hoc shapes inside
a single request, which is why a decision cannot be made without re-uploading a
file. Introduce a persisted **evidence record**, written by extraction and by the
applicant, read by every decision service:

| Field | Why it exists |
| --- | --- |
| `kind` | qualification · employment_role · language_test · accreditation · secondary_result |
| `claim` | The normalised fact, typed per kind |
| `provenance` | `extracted` · `applicant_asserted` · `staff_verified` |
| `trustTier` | `applicant_asserted` · `extracted_from_issued_document` · `staff_verified` |
| `sourceDocumentId`, `sourceExtractionId` | Traces every fact to the page it came from |
| `confidence` | Drives the human-review threshold |
| `supersedes` | Corrections create new records; nothing is overwritten |
| `classifications[]` | Vocabulary codes, each with its own confidence and vocabulary version |

**A CV is a claim; a transcript is evidence.** A CV asserting a completed
master's degree is not the same fact as a transcript showing it. Requirements
must be able to declare the minimum trust tier that satisfies them: CV-derived
facts pre-fill forms and rank courses, but generally cannot satisfy an admission
requirement alone. The codebase already learned this empirically — the
applications domain contract requires transcript evidence for a positive credit
estimate and permits CV relevance only alongside it — but encodes it as a special
case inside the UC flow. As a property of the data model it applies everywhere.

**Pre-fill is not evidence.** Pre-fill proposes values for form fields. Evidence
is what decisions read. Fused, an applicant editing a field silently changes an
admission decision with no record of what the document said.

### 4.3 Four stores

| Store | Holds | Changes when | Hard part |
| --- | --- | --- | --- |
| **Rule sets** | Entry and credit requirements per institution × program | An institution revises policy | Review and approval workflow |
| **Reference vocabularies** | OSCA occupations, AQF levels, institution registry, English-medium countries | ABS or a regulator publishes a release | Version-stamping every classification |
| **Evidence** | Per-applicant typed facts with provenance and trust tier | Continuously | Superseding rather than overwriting |
| **Decisions** | Recorded outcomes with inputs, rule version and reason codes; credit precedents | Append-only | Similarity — when a past decision should bind a new one |

### 4.4 The rule format is already right

`requirements.generated.json` contains a genuinely well-designed schema:

```
version: 2
global[]        requirements applying to every pathway
pathways[]      alternative routes (OR)
  requirements[]  conditions within a route (AND)
    kind            one of 14 known kinds
    params          typed per kind
    sourceText      the published wording, kept attached
    weight
```

Four non-obvious calls, all correct: pathways-as-alternatives matches how
admission rules genuinely work; `global` separates universal from route-specific
conditions; `kind` is drawn from a closed vocabulary with a typed evaluator each;
`sourceText` keeps published wording attached, which is what makes a rule
reviewable by an admissions officer and citable in an appeal.

**Resist generalising this into an expression language** when institutions two
and three arrive. A closed vocabulary is worth defending: an admissions officer
can review a typed requirement and cannot review an expression tree; each kind
gets a real evaluator with real tests; and an expression evaluator fed by scraped
content is a code-execution surface. When a rule does not fit, add a fifteenth
kind.

What the format needs that it does not have: institution scoping, version and
effective dates, approval state and approver, diff review on re-ingestion, and
credit rules alongside entry rules. Store each rule set as one validated JSON
document per row — the document is the unit that gets versioned, approved and
cited by a decision.

---

## 5. Gaps that block production

Ranked. The first four are new findings from the architecture review and are the
reason Track A grew.

| # | Gap | Impact |
| --- | --- | --- |
| 1 | **No occupation reference dataset.** The CV prompt asks the model to return an OSCA code, title and skill level from memory. No occupation list, index or lookup exists. Every six-digit code in the repository comes from a demo fixture, a test placeholder or a sentinel. | Skill level flows into `assessUcAdmission`, which converts it to an equivalent GPA band. Wrong codes are plausible, well-formatted and unverifiable. |
| 2 | **Admission and credit decisions execute in the browser.** `assessUcAdmission`, `rankUcCourses`, `getUcIndicativeCreditPoints` and `assessUcShortlistCredit` are all called from `UcRplCourseMatcher.tsx` — roughly 1,300 lines client-side. `applyEligibilityResolution` runs both in the API proxy and in the browser. | No decision is recorded, so none can be replayed for an appeal or a rule change; nothing is auditable; the logic is modifiable by anyone with developer tools. |
| 3 | **No evidence model.** Extraction and decision exchange ad-hoc shapes within one request. | A decision cannot be made, tested or replayed without re-uploading a file. |
| 4 | **No credit precedent concept.** Zero references in the codebase. | Credit assessment restarts from the model on every application instead of getting more consistent over time. |
| 5 | **No admissions staff portal.** `business_users` is a bare table — no UI, roles, queues or decision recording. | Applications can be submitted but never assessed. |
| 6 | **No offer or enrolment lifecycle.** Status is `draft` / `submitted` only. | No conditional offers, acceptance, deferral or withdrawal. |
| 7 | **No student system integration.** No connector to Callista, TechnologyOne, Ellucian Banner or Salesforce Education Cloud. | Submitted applications are a dead end for the institution. |
| 8 | **No gating end-to-end suite.** See 3.2. | A ~40-screen flow has no verification that can fail a build. |
| 9 | **No accessibility work.** ~99 ARIA attributes app-wide, no axe integration, no assistive-technology testing, no audit. | Direct Disability Discrimination Act 1992 exposure on a product that is almost entirely forms. |
| 10 | **Course catalogue is a committed snapshot.** 67 courses of LLM-generated, hand-reviewed requirements compiled into the bundle. | Wrong requirements produce wrong decisions; changing one course needs a deployment. |
| 11 | **Demonstration fixtures on production paths.** A deterministic credit result keyed to a named public figure's normalised identity ships in the UC flow. | Must be removed or hard-gated before real traffic. |
| 12 | **Privacy and records compliance unaddressed.** No retention or deletion policy, DSR tooling, consent records, privacy impact assessment or data-residency position; OpenAI processing is offshore. The analytics identity salt is documented as bundled and reversible. | Australian Privacy Act and APP exposure; TEQSA and ESOS record-keeping unmet. |
| 13 | **No payments.** No application fee, deposit, refund or reconciliation. | Blocks most fee-charging admissions models. |
| 14 | **No applicant communications beyond auth email.** | Applicants have no channel after submitting. |
| 15 | **Operational maturity.** No infrastructure-as-code, SLOs, load testing, restore rehearsal, incident runbook or on-call. Rate limiting is in-memory. | Cannot be operated to an institutional service standard. |
| 16 | **Build-time single tenancy.** Brand is an environment variable; catalogues are compile-time imports. | A second institution needs a separate deployment. |
| 17 | **No international-cohort support.** No i18n, CRICOS or GTE handling, non-AQF frameworks, or agent portal. | Excludes the largest revenue segment in Australian higher education. |

---

## 6. Effort breakdown

One engineer-week is one productive engineer for five days, inclusive of code
review and their own testing.

### Track A — Production-grade decision layer and hardening

**A1 — Decision services**

| Workstream | Low | High |
| --- | --- | --- |
| Evidence model, store, provenance and trust tiers | 4 | 6 |
| Extraction service — job-based, all five document kinds, provider interface | 6 | 9 |
| OSCA reference data, occupation matcher and eval set | 6 | 9 |
| Qualification classification — AQF level, field of education, overseas equivalence | 4 | 6 |
| Eligibility, English and secondary/accreditation assessment, server-side and recorded | 6 | 9 |
| Work-experience assessment behind the API | 3 | 5 |
| Credit and RPL assessment, de-branded from UC and moved server-side | 5 | 8 |
| Course matching and discovery from evidence | 4 | 6 |
| Credit precedent — model, similarity, capture, governance | 6 | 9 |
| Rule sets as a governed store — institution scoping, versioning, effective dating, ingestion and approval workflow | 6 | 9 |
| Eval harness, confidence thresholds, review routing, reason codes, cost budgets | 8 | 11 |
| **A1 subtotal** | **58** | **87** |

**A2 — Hardening the applicant journey**

| Workstream | Low | High |
| --- | --- | --- |
| Team onboarding and knowledge transfer from the sole author | 3 | 5 |
| Automated test foundation — convert the non-asserting bot into a gating Playwright suite, add a real component-test layer, coverage gates, flake control | 10 | 14 |
| Accessibility to WCAG 2.2 AA — audit, remediation across every form, assistive-technology passes, VPAT | 6 | 9 |
| Security and privacy hardening — threat model, external penetration test and remediation, audit logging, retention and deletion, DSR tooling, privacy impact assessment | 8 | 11 |
| Split the three fat API routes, extract shared middleware, clear Phase 2/3 debt, remove demonstration fixtures | 4 | 6 |
| Applicant communications — status emails, document requests, reminders, preference centre | 3 | 5 |
| Platform and operations — staging discipline, infrastructure-as-code, shared-store rate limiting, SLOs, load testing, restore rehearsal, runbooks, on-call | 5 | 7 |
| **A2 subtotal** | **39** | **57** |

| | Low | High |
| --- | --- | --- |
| **Track A total** | **97** | **144** |

### Track B — Make it a real admissions system

| Workstream | Low | High |
| --- | --- | --- |
| Admissions staff portal — RBAC, work queues, assessment workbench, document verification, the low-confidence review queue, notes, decision recording, audit trail | 20 | 28 |
| Offer and enrolment lifecycle — conditional and unconditional offers, letter generation, acceptance, deferral, withdrawal | 10 | 14 |
| Student system integration — one target system, bidirectional, with reconciliation | 12 | 18 |
| Payments — application fee and deposit, refunds, reconciliation, receipting | 5 | 8 |
| Admissions reporting — funnel, SLA, conversion, statutory extracts | 6 | 9 |
| **Track B subtotal** | **53** | **77** |

### Track C — Multi-institution platform

| Workstream | Low | High |
| --- | --- | --- |
| Runtime tenancy — tenant model, data isolation, per-tenant configuration and theming, tenant admin, onboarding | 16 | 22 |
| Education agent / counsellor portal | 8 | 12 |
| International cohort — internationalisation, CRICOS and GTE, overseas qualification frameworks | 10 | 15 |
| **Track C subtotal** | **34** | **49** |

Track A's rule-set store already carries institution scoping, so the tenancy line
inherits that work rather than repeating it.

### Cumulative

| Track | Engineer-weeks | Realistic calendar | Team |
| --- | --- | --- | --- |
| A | 97 – 144 | 6 – 9 months | 5 – 6 |
| A + B | 150 – 221 | 12 – 16 months | 7 – 8 |
| A + B + C | 184 – 270 | 18 – 24 months | 8 – 10 |

Calendar exceeds effort divided by team size because student-system integration,
penetration testing, accessibility certification, reference-data sourcing and
admissions-policy sign-off all depend on third parties.

---

## 7. Reconciliation with the earlier figure

Track A was first estimated at 53–77 engineer-weeks, before the API and
architecture review.

| Line | Low | High |
| --- | --- | --- |
| Track A as first estimated | 53 | 77 |
| Less: AI-governance line, superseded by the eval harness in A1 | −8 | −11 |
| Less: course-requirements-management line, superseded by the rule store in A1 | −6 | −9 |
| Plus: decision services (A1) | +58 | +87 |
| **Revised Track A** | **97** | **144** |

The applicant-facing application API, sized at 8–12 weeks during the API review,
is excluded — it has since been built.

The increase is not scope creep. The first estimate treated the intelligence
layer as existing and needing governance wrapped around it. Inspection showed
that occupation grounding, server-side decisions, the evidence model and credit
precedent are builds. The three fat API routes and the client-side decision
functions are working demonstrations of the right ideas, not production
implementations of them.

---

## 8. Skills required

| Role | Track A | Track B adds | Why this codebase needs it |
| --- | --- | --- | --- |
| AI / LLM engineer | 1.0 | +0.5 | Extraction schemas, grounded classification, eval harnesses for output that feeds regulated decisions, cost and latency control |
| Senior full-stack engineer (React / TypeScript) | 2.0 | +1.0 | React 19, strict TypeScript, Vite 8, Tailwind 4, a bespoke design system, ~40 route-level screens |
| Backend / data engineer (Postgres + Supabase) | 1.0 | +1.0 | ~6,100 lines of SQL, 35 RLS policies, ~25 PL/pgSQL functions, a 2,100-line submission migration, plus the evidence and decision stores |
| Data engineer (reference data and similarity) | 0.5 | +0.5 | OSCA ingestion and versioning, occupation matching, credit-precedent similarity |
| QA / test automation engineer | 1.0 | +0.5 | No gating end-to-end suite; component tests render static markup only |
| Accessibility specialist (contract) | 0.5 | +0.25 | Form-heavy product, no accessibility testing, statutory exposure |
| DevOps / SRE | 0.5 | +0.5 | Three hosting providers, no infrastructure-as-code, no restore rehearsal, no SLOs |
| Application security engineer + external penetration test | 0.25 | +0.25 | Identity documents, academic transcripts, disability and health data |
| Integration engineer (SIS / CRM) | — | 1.0 | Callista, TechnologyOne, Ellucian Banner or Salesforce Education Cloud; SOAP, REST, SFTP, batch reconciliation |
| Product designer | 0.5 | +0.5 | Extending the design system to staff-facing assessment workflows |
| Product manager / BA, admissions domain | 1.0 | +0.0 | Entry requirements, credit and RPL policy, offer rules, TEQSA / ESOS / CRICOS |
| Admissions domain SME (institution-supplied) | 0.5 | +0.5 | Labelling ground truth and signing off that a matched occupation code is correct — materially more time than a pure hardening track would need |
| Privacy / compliance advisor (fractional) | 0.2 | +0.2 | Privacy Act and APPs, automated decision-making disclosure, data residency |

Track C additionally needs a platform engineer experienced in multi-tenant data
isolation, and a localisation lead.

**The three hardest roles to fill** for this system: an AI engineer who can build
evaluation harnesses for extraction feeding regulated decisions; a Postgres
engineer genuinely fluent in RLS and `security definer` boundaries; and an
integration engineer with real Australian student-system experience.

---

## 9. Cost

Australian dollars, excluding GST. Engineering effort times rate, then a 30%
loading for non-engineering delivery and 18% contingency.

| Rate basis | Per eng-week | Track A | A + B | A + B + C |
| --- | --- | --- | --- | --- |
| In-house permanent team, loaded | $4.0k – $5.5k | $600k – $1.22m | $920k – $1.87m | $1.13m – $2.28m |
| Local contract engineers | $5.5k – $7.5k | $820k – $1.66m | $1.27m – $2.54m | $1.55m – $3.11m |
| Consultancy / delivery partner | $8.0k – $11.0k | $1.19m – $2.43m | $1.84m – $3.73m | $2.26m – $4.56m |

### Annual running cost

At roughly 25,000 applications per year, excluding people.

| Item | Annual |
| --- | --- |
| Vercel | $500 – $6,000 |
| Supabase (Pro to Team) | $400 – $12,000 |
| Render — two services, with redundancy | $900 – $4,000 |
| Sentry | $1,200 – $6,000 |
| PostHog | $0 – $9,000 |
| Transactional email | $300 – $2,500 |
| OpenAI — 3–6 structured `gpt-4.1-mini` calls per application, roughly $0.05–$0.25 per application in total | $1,250 – $6,250 |
| Google Places, via the suggestion service | $500 – $3,000 |
| Annual penetration test | $15,000 – $35,000 |
| **Total infrastructure and services** | **$20k – $84k** |

Ongoing engineering to run and evolve the platform: 2–3 FTE, roughly
$400k – $700k per year.

---

## 10. Recommended sequence

1. **Evidence spine first — two to three weeks.** Every service reads it, and
   retrofitting provenance and trust tiers once four services depend on them is
   expensive. Getting the CV-versus-transcript distinction into the schema now is
   what makes every later claim about the system defensible.
2. **Rule sets as a governed store.** Lift the existing format out of the bundle
   into a versioned, effective-dated, approved table with institution scoping.
   This is also the gate on a second institution, so it is the commercial
   unblocker. Steps 1 and 2 together are roughly six to nine engineer-weeks, and
   both are pure engineering — no model-accuracy risk, no labelling dependency —
   so they are the right work to do while reference data is sourced in parallel.
3. **The OSCA vocabulary and matcher, with its eval set.** Upstream of three
   capabilities and currently the least trustworthy step. Its real accuracy
   ceiling determines what work-experience matching can honestly promise. Find
   out before the roadmap depends on it.
4. **Move existing decisions server-side unchanged.** Recorded and replayable,
   matching today's behaviour exactly. That baseline is what every later
   improvement is measured against.
5. **In parallel from week one: commission the external penetration test and
   accessibility audit,** widen the LLM regression job from path-triggered to a
   standing scheduled measurement (and correct `docs/workflows/ci.md`, which
   still calls it paused), and remove the demonstration fixtures.
6. **Decide the tenancy question before Track B.** Whether this is one
   institution's portal or a multi-institution platform changes the tenancy
   model, and retrofitting after Track B costs materially more.
7. **Secure a named student-system integration target early.** Longest lead time
   in Track B, least under the delivery team's control.
8. **Credit precedent last.** It needs recorded decisions to exist and assessors
   in the system to set them.

**Before committing the full budget**, steps 1–3 plus the audits in step 5 cost
roughly 16–24 engineer-weeks and would tighten every figure in this document
materially — particularly the occupation-matching accuracy ceiling, which is the
largest single unknown.

---

## 11. Supporting detail

Three companion analyses were produced alongside this document and remain the
detailed reference for their areas:

- **API surface decomposition** — audit of the ten existing routes, which three
  need splitting and why, and the target endpoint surface.
- **Decision services specification** — the extract/classify/decide endpoint set,
  and the capabilities missing from an initial scoping.
- **Pipeline and stores** — the shared CV/transcript pipeline, the four stores,
  and rule-set governance.

Where they disagree with this document, this document is current: it reconciles
figures that moved as the review progressed.
