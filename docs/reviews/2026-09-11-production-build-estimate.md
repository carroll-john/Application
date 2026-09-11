# Production Build Estimate — Applications Platform

> **Dated assessment.** Records the codebase as observed on 2026-09-11 at commit
> `ef42d3b`. It is not current implementation guidance. See
> [`../system-context.md`](../system-context.md) for current ownership and boundaries.

Review date: 2026-09-11
Purpose: size the work required to take this prototype to a production university
admissions platform, and identify the skills needed to do it.

---

## 1. Headline

The applicant-facing journey is substantially built and engineered well above
typical prototype standard. The institution-facing half of an admissions
platform — assessment, decisions, offers, integration with the student system —
does not exist at all.

| Half of the product | State |
| --- | --- |
| Applicant experience (discover → apply → submit) | ~70–80% of a production build |
| Institution experience (assess → decide → offer → enrol) | ~5% (an empty `business_users` table) |

This is a **harden and extend** estimate, not a rebuild estimate. Nothing found
in this review argues for starting again.

### Effort and cost summary

| Track | Scope | Engineer-weeks | All-in cost (AUD ex GST, contract-engineer basis) | Calendar |
| --- | --- | --- | --- | --- |
| **A** | Production-harden the existing applicant experience, single institution | 53–77 | $450k – $890k | 3–4 months, team of 5–6 |
| **A + B** | Add admissions staff portal, offer lifecycle, SIS integration, payments | 106–154 | $890k – $1.77m | 7–9 months, team of 7–8 |
| **A + B + C** | Multi-institution SaaS platform with agent portal and international cohort | 140–203 | $1.18m – $2.34m | 12–16 months, team of 8–10 |

All-in figures apply a 30% loading for non-engineering delivery (product, design,
BA, manual QA, domain SME) and 18% contingency to the engineering effort.
Section 6 gives the same effort priced against in-house and consultancy rates.

---

## 2. What has been built

Roughly 695 files: ~38,500 lines of production TypeScript/TSX in `src`, ~8,400 in
`api`, ~6,100 lines of SQL migrations, ~3,800 lines in the in-repo rules package,
and ~20,000 lines of test code across 131 test files and 832 test cases.
Built over roughly two months across ~265 pull requests.

### 2.1 Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript 6 (strict), Vite 8, Tailwind CSS 4, React Router 7, `react-datepicker`, `date-fns`, `lucide-react` |
| Design system | Code-based — `src/index.css` tokens plus `src/components/ui/*` primitives; brand selected at build time (`VITE_APP_BRAND`) |
| API | Vercel serverless functions, Node ESM, Web Fetch handlers |
| Data | Supabase — Postgres 17, Auth (email/password + TOTP MFA), private Storage bucket, Row Level Security |
| AI | OpenAI (`gpt-4.1-mini`) via versioned prompts and JSON output schemas |
| Rules engine | `vendor/eligibility-rules`, an in-repo TypeScript package consumed by app, proxy and tooling |
| Observability | Sentry (browser + server, AI spans, session replay), PostHog (typed event catalogue, AI observability, support launcher) |
| Email | Resend, as custom SMTP behind Supabase Auth |
| Hosting | Vercel (SPA + functions), Supabase Cloud, Render (two extracted services) |
| CI | 4 GitHub Actions workflows plus a one-way Azure Pipelines mirror |

### 2.2 Frontend components and features

1. **Course discovery** — browse, filters, results panel, cards, detail page with
   hero and checklist. Two committed catalogues: 34 StudyNext courses, 33 UC courses.
2. **Pre-application eligibility check** — modal, result modal, deterministic rules,
   per-course evidence display.
3. **Authentication** — sign up, sign in, email confirmation, forgot/reset password,
   TOTP MFA enrolment and challenge, password change with re-authentication,
   leaked-password check against Have I Been Pwned.
4. **Applicant profile** — details, password and MFA sections.
5. **Dashboard** — multiple concurrent applications, tabs, list, continue panel.
6. **Section 1 (personal), 6 steps** — basic info, contact info, personal contact,
   address with Google Places autocomplete, cultural background, family support
   and disability.
7. **Section 2 (qualifications), hub plus 6 record types** — secondary, tertiary
   with transcript, CV, employment, language test, professional accreditation;
   plus supporting-evidence panel, evidence plan, next-step panel and an applicant
   eligibility-dispute form.
8. **Review and submit** — per-section summaries, validation panel, declaration.
9. **UC credit / RPL demonstration** — course matcher, experience review, credit
   assessment comparison panel.
10. **Shared UI kit** — button, input, label, native select, autocomplete,
    institution autocomplete, address autocomplete, date controls, modal shell,
    surface card, status pill, file upload, document upload field, brand header /
    footer / chrome, loading and fallback states, route error boundary.
11. **Cross-cutting** — lazy route loading with chunk-recovery retry, scroll
    restoration, PostHog support launcher, Sentry route instrumentation.

### 2.3 Serverless API surface

| Endpoint | Responsibility |
| --- | --- |
| `POST /api/parse-cv` | CV → structured employment history via OpenAI |
| `POST /api/evaluate-transcript-eligibility` | Transcript → evidence, proxied to `eligibility-service`, with a local OpenAI fallback |
| `POST /api/evaluate-work-experience` | Work experience → RPL / credit assessment |
| `GET /api/document-delivery` | Signed delivery of private stored documents |
| `POST /api/capture-eligibility-feedback` | Applicant dispute capture |
| `POST /api/capture-auth-sign-up-succeeded` | Server-side sign-up analytics |
| `POST /api/check-leaked-password` | k-anonymity breach check |
| `POST /api/csp-report` | CSP violation collector |
| `GET /api/suggest/addresses`, `GET /api/suggest/institutions` | Proxy to `suggest-service` |

Shared internal modules: `_ai` (LLM invocation, OpenAI request/response, tracing,
5 versioned prompts, 5 output schemas), `_documentParser`, `_cvParser`,
`_eligibility`, `_suggest`, and `_shared` (rate limiter, Sentry, PostHog,
auth, document file policy, analytics identity).

### 2.4 Data layer

- **11 tables** — `applications`, `application_documents`, `applicant_profiles`,
  `business_users`, `tertiary_qualifications`, `secondary_qualifications`,
  `employment_experiences`, `language_tests`, `professional_accreditations`,
  `course_submission_policies`, `allowed_email_domains`.
- **~25 functions**, including the server-authoritative `submit_application` RPC,
  `application_submission_missing_fields`, and a `private` schema of upload-limit,
  storage-integrity and MFA-enforcement helpers.
- **35 RLS policies** across 30 migrations, including AAL2 enforcement for users
  with an enrolled MFA factor.
- **Private storage bucket** with size and MIME limits enforced by both bucket
  configuration and database triggers.
- **SQL test suite** covering enrolled-MFA AAL2 and server-authoritative submission.

### 2.5 Domain rules package

`vendor/eligibility-rules` — AQF levels, academic results normalisation,
English-medium countries, Australian institutions, requirement evaluators,
requirement-kind registry, deterministic rules, matcher, submit policy, work
experience, and course requirements v2 with an evaluation harness.

### 2.6 External services and dependencies

| Service | Type | Owner |
| --- | --- | --- |
| Supabase | Runtime | Auth, Postgres, Storage, RLS, submit RPC |
| `eligibility-service` (Render) | Runtime, separate repo | Conservative transcript evidence extraction |
| `suggest-service` (Render) | Runtime, separate repo | Institution index and Google Places addresses |
| OpenAI | Runtime | Reached only through server-side routes |
| Sentry, PostHog | Runtime | Monitoring and product analytics, both fail-open |
| Resend | Runtime | Transactional auth email via Supabase SMTP |
| Google Places | Runtime, via `suggest-service` | Address autocomplete |
| Have I Been Pwned | Runtime | Leaked-password check |

### 2.7 Engineering tooling

35 scripts covering parser regression suites, eligibility evaluation and golden
fixtures, a course-requirements parsing pipeline, a synthetic persona-driven
funnel bot, console and brand smoke tests, orphaned-document cleanup, service
health checks, documentation contract validation, worktree task lifecycle,
Supabase env sync and stakeholder-note publishing.

---

## 3. Quality assessment

### 3.1 Genuine strengths

These are the reasons this is an extend-and-harden job rather than a rewrite.

- **Type discipline.** TypeScript strict mode, zero `: any` in production code,
  three TODO/FIXME markers in the entire non-test codebase.
- **Test depth.** 832 test cases, ~20,000 lines of test code, contract tests that
  protect every declared duplication between TypeScript and SQL.
- **Architecture governance.** An authoritative `system-context.md` with an
  ownership map, forbidden shortcuts, seven ADRs, and a machine-validated
  documentation contract (`npm run context:check`).
- **Server-authoritative submission.** The client is explicitly a UX mirror; the
  `submit_application` RPC and a database-owned course-policy snapshot are the
  final authority. Submitted records and evidence are immutable to applicants.
- **Security posture well beyond prototype level.** Enforced CSP with reporting,
  HSTS, `X-Content-Type-Options`, `Permissions-Policy`, TOTP MFA enforced in both
  the browser and RLS via the JWT `aal` claim, per-route rate limiting, database
  and storage upload quotas, leaked-password checks, anon-role grants explicitly
  revoked and pg_graphql exposure disabled.
- **Real observability.** Typed analytics event catalogue with a lint rule
  preventing direct SDK use, AI observability spans, session replay with
  route-level privacy sync.

### 3.2 Gaps that block production

| # | Gap | Impact |
| --- | --- | --- |
| 1 | **No admissions staff portal.** `business_users` is a bare table with no UI, no roles, no queues, no decision recording. | Applications can be submitted but never assessed. |
| 2 | **No offer or enrolment lifecycle.** Application status is `draft` / `submitted` only. | No conditional offers, acceptance, deferral or withdrawal. |
| 3 | **No student system integration.** No connector to Callista, TechnologyOne, Ellucian Banner, or Salesforce Education Cloud. | Submitted applications are a dead end for the institution. |
| 4 | **No end-to-end test suite.** Playwright is installed but used only for console and brand smoke checks; the two component tests use `renderToStaticMarkup`, so no interaction is exercised anywhere. | A ~40-screen multi-step form flow has no end-to-end verification. |
| 5 | **No accessibility work.** ~99 ARIA attributes across the entire app, no axe integration, no screen-reader testing, no WCAG audit. | Direct Disability Discrimination Act 1992 exposure for an Australian education provider. |
| 6 | **AI quality gate switched off.** The LLM regression job has been paused in CI since July 2026. No PII minimisation before OpenAI, no confidence thresholds routing to human review, no model fallback, no cost ceiling, no audit trail of AI-influenced decisions. | Unmeasured drift on extraction that feeds admissions outcomes. |
| 7 | **Course catalogue is a committed snapshot.** 67 courses of LLM-generated, hand-reviewed entry requirements in JSON files compiled into the bundle. | Incorrect entry requirements produce incorrect admissions decisions; updating one course requires a deployment. |
| 8 | **Demonstration fixtures on production code paths.** A deterministic credit result keyed to a named public figure's normalised identity ships in the UC flow. | Must be removed or hard-gated before any real applicant traffic. |
| 9 | **No payments.** No application fee, deposit, refund or reconciliation. | Blocks most fee-charging admissions models. |
| 10 | **No applicant communications beyond auth email.** No status notifications, document requests, reminders or preference centre. | Applicants have no channel after submission. |
| 11 | **Build-time single tenancy.** Brand is an environment variable and catalogues are compile-time JSON imports. | A second institution requires a separate deployment. |
| 12 | **Privacy and records compliance not addressed.** No retention or deletion policy, no data-subject-request tooling, no consent records, no privacy impact assessment, no data-residency position (OpenAI processing is offshore). The analytics identity salt is documented as bundled and reversible. | Australian Privacy Act / APP exposure; TEQSA and ESOS record-keeping unmet. |
| 13 | **Operational maturity.** No infrastructure-as-code, no SLOs, no load testing, no backup-restore rehearsal, no incident runbook, no on-call. Orphaned-document cleanup is a manual dry-run script. | Cannot be operated to an institutional service standard. |
| 14 | **Documented debt outstanding.** Phase 2: remove legacy IndexedDB document store, enforce module boundaries in CI. Phase 3: single source for eligibility rules, remove local AI and suggestion fallbacks, publish provider-owned contracts. | Two long-term owners exist for extraction and suggestions. |
| 15 | **No internationalisation or international-cohort support.** No i18n, no CRICOS or GTE handling, no non-AQF qualification frameworks, no education-agent portal. | Excludes the largest revenue segment in Australian higher education. |

### 3.3 Delivery risks

- **Bus factor of one.** 59 of 60 commits are by a single author, working with AI
  assistance. No second engineer has read this system. Onboarding is budgeted
  explicitly in Track A.
- **Cross-repo contract drift.** Two runtime dependencies live in separate repos
  and deploy independently; contract tests exist on the caller side only. The
  provider-published contract remains Phase 3 work.
- **Rules correctness is unvalidated against real policy.** The eligibility engine
  is well tested against its own fixtures. It has not been signed off by an
  admissions authority for any institution.

---

## 4. Effort breakdown

One engineer-week = one productive engineer for five days, inclusive of code
review and their own testing.

### Track A — Production-harden the applicant experience (single institution)

| Workstream | Low | High |
| --- | --- | --- |
| Team onboarding and knowledge transfer from the sole author | 3 | 5 |
| Automated test foundation — Playwright E2E over the full journey, a real component-test layer (jsdom/RTL), coverage gates, flake control | 10 | 14 |
| Accessibility to WCAG 2.2 AA — audit, remediation across every form, assistive-technology passes, VPAT | 6 | 9 |
| Security and privacy hardening — threat model, external penetration test and remediation, audit logging, retention and deletion, DSR tooling, privacy impact assessment | 8 | 11 |
| AI governance — eval harness gating merges, PII minimisation before OpenAI, confidence thresholds with a human-review path, model fallback, cost budgets, decision audit trail | 8 | 11 |
| Course and requirements management — replace committed JSON with a managed store: CRUD, versioning, effective dating, approval workflow | 6 | 9 |
| Clear Phase 2 / Phase 3 debt, remove demonstration fixtures, harden service contracts both sides | 4 | 6 |
| Applicant communications — status emails, document requests, reminders, templates, preference centre | 3 | 5 |
| Platform and operations — staging discipline, infrastructure-as-code, SLOs, load testing, DR restore rehearsal, runbooks, on-call, automated orphan cleanup | 5 | 7 |
| **Track A subtotal** | **53** | **77** |

### Track B — Make it a real admissions system

| Workstream | Low | High |
| --- | --- | --- |
| Admissions staff portal — RBAC, work queues, assessment workbench, document verification, notes, decision recording, bulk actions, full audit trail | 20 | 28 |
| Offer and enrolment lifecycle — conditional and unconditional offers, offer letter generation, acceptance, deferral, withdrawal, expanded status model | 10 | 14 |
| Student system integration — one target system, bidirectional, with reconciliation and error handling | 12 | 18 |
| Payments — application fee and deposit, refunds, reconciliation, receipting | 5 | 8 |
| Admissions reporting — funnel, SLA, conversion, statutory reporting extracts | 6 | 9 |
| **Track B subtotal** | **53** | **77** |

### Track C — Multi-institution platform

| Workstream | Low | High |
| --- | --- | --- |
| Runtime tenancy — tenant model, data isolation, per-tenant configuration, theming and catalogues, tenant admin, onboarding | 16 | 22 |
| Education agent / counsellor portal | 8 | 12 |
| International cohort — i18n, CRICOS and GTE handling, overseas qualification frameworks, country-specific rules | 10 | 15 |
| **Track C subtotal** | **34** | **49** |

### Cumulative

| Track | Engineer-weeks | Realistic calendar | Team |
| --- | --- | --- | --- |
| A | 53 – 77 | 3 – 4 months | 5 – 6 |
| A + B | 106 – 154 | 7 – 9 months | 7 – 8 |
| A + B + C | 140 – 203 | 12 – 16 months | 8 – 10 |

Calendar is longer than effort ÷ team size because student-system integration,
penetration testing, accessibility certification and admissions-policy sign-off
all depend on third parties and institutional availability.

---

## 5. Skills required

| Role | Track A | Track B adds | Why this codebase needs it |
| --- | --- | --- | --- |
| Senior full-stack engineer (React / TypeScript) | 2.0 | +1.0 | React 19, strict TypeScript, Vite 8, Tailwind 4, a bespoke code-based design system, ~40 route-level screens and hook-based application orchestration |
| Backend / data engineer (Postgres + Supabase) | 1.0 | +1.0 | ~6,100 lines of SQL, 35 RLS policies, ~25 PL/pgSQL functions, a 2,100-line server-authoritative submission migration, storage triggers and quota enforcement |
| AI / LLM engineer | 1.0 | +0.5 | Versioned prompts and JSON schemas for CV, transcript and work-experience extraction; needs eval harnesses, PII minimisation, confidence gating and cost control |
| QA / test automation engineer | 1.0 | +0.5 | No E2E suite exists and component tests render static markup only |
| Accessibility specialist (contract) | 0.5 | +0.25 | Form-heavy product with no accessibility testing and statutory exposure |
| DevOps / SRE | 0.5 | +0.5 | Three hosting providers, no infrastructure-as-code, no DR rehearsal, no SLOs |
| Application security engineer + external penetration test | 0.25 | +0.25 | Handles identity documents, academic transcripts, and disability and health data |
| Integration engineer (SIS / CRM) | — | 1.0 | Callista, TechnologyOne, Ellucian Banner or Salesforce Education Cloud; SOAP, REST, SFTP and batch reconciliation |
| Product designer | 0.5 | +0.5 | Extending the code-based design system to staff-facing assessment workflows |
| Product manager / BA with admissions domain knowledge | 1.0 | +0.0 | Entry requirements, credit and RPL policy, offer rules, TEQSA / ESOS / CRICOS |
| Admissions domain SME (institution-supplied) | 0.25 | +0.25 | Validating the rules engine against real published policy |
| Privacy / compliance advisor (fractional) | 0.2 | +0.2 | Privacy Act and APPs, automated decision-making disclosure, data residency |

Track C additionally requires a platform engineer experienced in multi-tenant
data isolation, and a localisation lead.

**The three hardest roles to fill** for this specific system: an AI engineer who
can build eval harnesses for extraction that feeds regulated decisions; a
Postgres engineer genuinely fluent in RLS and `security definer` boundaries; and
an integration engineer with real Australian student-system experience.

---

## 6. Cost

Australian dollars, excluding GST. Engineering effort × rate, then +30% for
non-engineering delivery (product, design, BA, manual QA, domain SME) and +18%
contingency.

| Rate basis | Per engineer-week | Track A | Track A + B | Track A + B + C |
| --- | --- | --- | --- | --- |
| In-house permanent team (loaded) | $4,000 – $5,500 | $330k – $650k | $650k – $1.30m | $860k – $1.71m |
| Local contract engineers | $5,500 – $7,500 | $450k – $890k | $890k – $1.77m | $1.18m – $2.34m |
| Consultancy / delivery partner | $8,000 – $11,000 | $650k – $1.30m | $1.30m – $2.60m | $1.72m – $3.43m |

### Annual running cost

At roughly 25,000 applications per year, excluding people:

| Item | Annual |
| --- | --- |
| Vercel | $500 – $6,000 |
| Supabase (Pro → Team) | $400 – $12,000 |
| Render (two services, with redundancy) | $900 – $4,000 |
| Sentry | $1,200 – $6,000 |
| PostHog | $0 – $9,000 |
| Transactional email (Resend) | $300 – $2,500 |
| OpenAI — 3–6 structured calls per application at roughly $0.05–$0.25 each | $1,500 – $7,500 |
| Google Places via `suggest-service` | $500 – $3,000 |
| Annual penetration test | $15,000 – $35,000 |
| **Total infrastructure and services** | **$20k – $85k** |

Ongoing engineering to run and evolve the platform: 2–3 FTE, roughly
$400k – $700k per year.

---

## 7. Recommended sequence

1. **Weeks 1–5 — De-risk before committing.** Onboard two engineers, restore the
   paused LLM regression gate and measure current extraction accuracy, remove the
   demonstration fixtures, and commission an external penetration test and
   accessibility audit. This costs roughly 8–12 engineer-weeks and materially
   tightens every figure above.
2. **Decide the product question before Track B.** Whether this is one
   institution's application portal or a multi-institution platform changes the
   tenancy model, and retrofitting tenancy after Track B is materially more
   expensive than building it during.
3. **Secure a named student-system integration target early.** It is the longest
   lead-time item in Track B and the one least under the delivery team's control.
4. **Get admissions policy sign-off on the rules engine before launch.** The
   engine is well tested against its own fixtures; it has never been validated
   against an institution's published entry requirements by someone accountable
   for them.
