# UC Assessment API Contract v1

All responses containing assessment or staff data are private and `no-store`.
All trusted result fields are server-generated. Browser-supplied results are
ignored or rejected.

## Applicant endpoints

| Endpoint | Auth | Contract |
| --- | --- | --- |
| `POST /api/assessment/activate` | Optional bearer | Validate invitation, allocate stable control/treatment cohort, and create/resume a treatment session only for the matching pre-invited user. |
| `GET/PATCH /api/assessment/session` | Bearer owner | Resume or update confirmed CV, shortlist, and allowed stage. |
| `POST /api/assessment/document` | Bearer owner | Validate and scan a CV into private quarantine. |
| `POST /api/assessment/evaluate` | Bearer owner | Validate and scan transcript, extract evidence, calculate and persist trusted versioned results. |
| `POST /api/assessment/start-application` | Bearer owner | Verify evaluated treatment session, promote passed-scan evidence to an existing owned application, and record partner/version context. Idempotent for the same session/application. |

`CreditEstimateResult` contains `potentialCreditPoints: number | null`,
`publishedCap`, `confidence`, mapped transcript evidence, manual-review reasons,
and catalogue/rules/model versions. `null` means no governed numeric claim can be
made; it is not a zero-credit decision.

## Staff endpoints

| Endpoint | Contract |
| --- | --- |
| `GET /api/staff/reviews` | AAL2 + active partner role; keyset-style queue page; audit access. |
| `GET/PATCH /api/staff/review` | AAL2 + active partner role; audit view, claim, agree, or categorized correction. Reviewers cannot alter evidence. |
| `POST /api/staff/export` | AAL2 + active partner role; application and agreed/corrected review required; audited no-store ZIP of manifest, result JSON, review notes, and passed-scan documents. |

Review state is `unassigned → in_review → agreed | corrected → exported`.
Protected actions fail when their audit event cannot be written.

## Kill switches

- `UC_ASSESSMENT_TREATMENT_ENABLED` defaults treatment invitations to the control
  journey unless explicitly `true`.
- `UC_ASSESSMENT_APPROVED_RULES_VERSION` must exactly equal the committed rules
  version and every governed course must contain UC approval metadata before any
  numeric guidance is returned.
- Missing malware-scanner configuration fails document processing closed outside
  an explicitly enabled local development bypass.
