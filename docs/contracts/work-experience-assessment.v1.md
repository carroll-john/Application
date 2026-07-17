# Work Experience Assessment — Contract v1

> **Status:** additive, ready for Preview (2026-07-16). This contract is independent of the
> pinned transcript eligibility contract.

## Endpoint

- **Method / URL:** `POST /api/evaluate-work-experience`
- **Auth:** applicant bearer session in deployed environments; local open mode follows the
  shared document-parser authentication policy.
- **Content type:** `application/json`

## Request

```json
{
  "requirements": [{
    "id": "work-1",
    "kind": "work_experience",
    "sourceText": "Three years relevant experience, including two years managing people.",
    "weight": "mandatory",
    "params": {
      "minYears": 3,
      "relevantTo": "the relevant professional field",
      "qualifyingRoleCriteria": {
        "description": "managing people",
        "minYears": 2
      }
    }
  }],
  "roles": [{
    "id": "employment-row-id",
    "position": "Operations Lead",
    "duties": "Led a team of six and owned workforce planning.",
    "startMonth": "January",
    "startYear": "2021",
    "endMonth": "",
    "endYear": "",
    "currentRole": true
  }]
}
```

Applicant names and employer names are excluded. The model receives requirement wording plus
role ID, title, and duties; dates are used only by deterministic application code.

## Response

HTTP 200 returns `{ "assessments": WorkExperienceAssessment[] }`, one item per supplied
requirement. Each assessment contains:

- status: `provisionally_met | possibly_met | not_demonstrated | needs_review`
- required, qualifying, and optional role-criteria month bounds
- role assessments with relevance, optional role-criteria status, counted duration,
  confidence, explanation, and exact source phrases
- unassessed conditions, input fingerprint, checked time, model ID (when used), prompt version,
  and schema version (`work-experience-assessment@v1`)

When a course has no `qualifyingRoleCriteria`, every role returns `roleCriteriaStatus =
not_required`; the service must not infer seniority. Title-only evidence cannot be normalised to
a definite relevance or role-criteria match.

## Deterministic resolution

- Calendar months only; no part-time/FTE weighting.
- Current roles end in the current month.
- Overlapping qualifying periods are merged.
- Year-only dates produce minimum and maximum possible periods.
- `provisionally_met` requires the minimum duration to meet every modelled threshold.
- `possibly_met` applies when only possible/max evidence reaches every threshold.
- `not_demonstrated` applies when even maximum evidence cannot reach the threshold.
- `needs_review` applies on service/model failure, unusable dates on potentially relevant roles,
  or an unmodelled qualifier such as post-qualification timing.

## Evidence and decision boundary

Results are advisory. Employer letters are stored separately against employment roles and are
not sent to or parsed by this endpoint. Neither an assessment nor a missing letter changes
submission eligibility. Admissions makes the final decision.

## Privacy and analytics

Analytics may contain only assessment status, role/assessment counts, coarse duration bands,
latency, and stable error codes. Employer names, duties, evidence phrases, explanations, and
filenames are prohibited.
