-- Migration: Persist the transcript eligibility assessment
--
-- The resolved transcript eligibility assessment (extracted evidence, requirement checks with
-- reason codes, pending evidence, version stamps) previously lived only in client memory, so the
-- "Supporting Eligibility Documentation" panel disappeared on reload and only a derived
-- transcript_confirms_completion boolean survived. Persist the full normalized assessment as
-- jsonb, one per tertiary qualification (latest scan wins — history/audit stays in PostHog via
-- rulesVersion/promptVersion stamps).

alter table public.tertiary_qualifications
  add column if not exists transcript_eligibility jsonb;

comment on column public.tertiary_qualifications.transcript_eligibility is
  'Latest normalized TranscriptEligibilityAssessment for this qualification''s transcript. Written by the client after a scan; shape is validated/clamped client-side by normalizeTranscriptEligibilityAssessment on load.';
