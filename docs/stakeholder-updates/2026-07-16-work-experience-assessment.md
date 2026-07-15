# Work Experience Assessment Update — 2026-07-16

## What shipped
- The implementation is ready for Preview: CV roles can now be checked against the selected
  course's relevant-experience requirement, including managerial or people-leadership criteria
  only where the course explicitly asks for them.
- Applicants see a conditional, explainable result and can correct the roles or dates used.
- Applicants can attach an optional signed employer letter to each relevant role. A missing
  letter never blocks submission, and uploaded letters remain for admissions review rather than
  being automatically verified.

## What is next
1. Apply the additive database migration in Preview.
2. Run synthetic CV and employer-letter checks, including reassessment after edits and refresh.
3. Confirm submission succeeds without a letter, then enable the same release in Production.

## How to provide feedback
- Reply in the Applications project channel with course wording that appears to classify the
  wrong roles, or with evidence-card wording that could be mistaken for a final admissions
  decision, before Production enablement.

## See/play with it
- Preview link will be added after the migration and branch deployment are complete.
- API and decision boundary: `docs/contracts/work-experience-assessment.v1.md`.
