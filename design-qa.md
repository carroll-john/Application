# UC matched-course refinement design QA

## Evidence

- Source visual truth: `output/design-qa/uc-course-match-source-viewport.png`
  and `output/design-qa/uc-course-match-source-cards.png`, captured from the
  annotated stable demo before the change.
- Implementation: `output/design-qa/uc-course-match-implementation-desktop-viewport.png`
  and `output/design-qa/uc-course-match-implementation-desktop-cards.png`.
- Expanded disclosure state:
  `output/design-qa/uc-course-match-implementation-desktop-expanded.png`.
- Mobile implementation:
  `output/design-qa/uc-course-match-implementation-mobile-viewport.png`.
- Desktop viewport: 989 x 958 CSS pixels. Source page device pixel ratio was 2
  and implementation device pixel ratio was 1; both browser screenshots were
  normalized to 989 x 958 output pixels before comparison.
- Mobile viewport: 390 x 844 CSS pixels at device pixel ratio 1.
- State: Maya Patel synthetic CV parsed, experience reviewed, Best matches
  selected, no transcript credit assessment completed.

## Full-view comparison

The source and implementation were compared at the same 989 x 958 viewport and
page state. The revised experience disclosure preserves the existing UC
typography, square content surfaces, colours, borders and spacing system while
removing approximately 300 pixels of above-course detail. Course imagery now
enters the first desktop viewport, which is the intended hierarchy change.

## Focused course-card comparison

The source and implementation course-card regions were compared separately
because the relevant copy was too small in the full-view comparison. The card
image, title, metadata, border, button and grid treatments are unchanged. The
applicant-facing entry copy no longer exposes OSCA or Skill Level terminology,
and the pre-assessment credit block is absent. Completed-assessment comparison
content is still covered by component tests.

## Required fidelity surfaces

- Fonts and typography: UC display and UI fonts, weights, line heights and title
  hierarchy are unchanged. The new disclosure uses existing UI text styles and
  wraps without clipping at 390 pixels.
- Spacing and layout rhythm: the intended density reduction is achieved without
  horizontal overflow at 989 or 390 pixels. The disclosure opens and closes
  without affecting surrounding controls.
- Colours and visual tokens: existing semantic UC tokens and shared border,
  background and action colours are reused; no page-local brand colours were
  introduced.
- Image quality and asset fidelity: existing UC course imagery and logos are
  unchanged, correctly cropped and sharp.
- Copy and content: course-card copy uses plain role descriptions; no OSCA or
  Skill Level wording remains in the rendered matched-course state. Credit
  content is hidden until a completed result exists.

## Interaction and runtime checks

- Synthetic CV upload reached review and matched-course states.
- Experience summary defaulted to `aria-expanded="false"`.
- Opening it revealed the detailed guidance and `Review my experience` action;
  closing it restored the compact state.
- Desktop and mobile had no horizontal overflow.
- No browser console warnings or errors were recorded.

## Findings

No actionable P0, P1 or P2 differences remain. The smaller header and cards are
intentional responses to the three annotations rather than visual drift.

## Comparison history

### Iteration 1

- Earlier source findings: the experience block delayed course visibility;
  course cards exposed internal OSCA terminology; provisional credit content was
  shown before assessment.
- Fixes made: collapsed disclosure, plain-language entry guidance, and
  result-gated credit content.
- Post-fix evidence: the aligned desktop full-view and focused card screenshots
  listed above. No additional P0, P1 or P2 issue was found.

## Implementation checklist

- [x] Keep the experience disclosure closed by default.
- [x] Preserve an accessible expand/collapse control and edit action.
- [x] Remove internal classification jargon from applicant-facing course cards.
- [x] Hide course-specific credit content before assessment.
- [x] Validate desktop, mobile, interaction and console states.

## Follow-up polish

No P3 follow-up is required for this scoped change.

final result: passed
