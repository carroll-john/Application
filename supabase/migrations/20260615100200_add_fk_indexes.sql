-- Migration: Add missing covering indexes for unindexed foreign keys
-- NOTE: indexes were created CONCURRENTLY on the live DB to avoid locking.
-- This migration uses plain CREATE INDEX IF NOT EXISTS (no CONCURRENTLY) so it
-- can run inside a transaction during CI / supabase db push. IF NOT EXISTS
-- makes it idempotent — already-created indexes are skipped safely.

CREATE INDEX IF NOT EXISTS idx_applications_applicant_profile_id
  ON public.applications(applicant_profile_id);

CREATE INDEX IF NOT EXISTS idx_applications_cv_document_id
  ON public.applications(cv_document_id);

CREATE INDEX IF NOT EXISTS idx_employment_experiences_application_id
  ON public.employment_experiences(application_id);

CREATE INDEX IF NOT EXISTS idx_language_tests_application_id
  ON public.language_tests(application_id);

CREATE INDEX IF NOT EXISTS idx_language_tests_document_id
  ON public.language_tests(document_id);

CREATE INDEX IF NOT EXISTS idx_professional_accreditations_application_id
  ON public.professional_accreditations(application_id);

CREATE INDEX IF NOT EXISTS idx_professional_accreditations_document_id
  ON public.professional_accreditations(document_id);

CREATE INDEX IF NOT EXISTS idx_secondary_qualifications_application_id
  ON public.secondary_qualifications(application_id);

CREATE INDEX IF NOT EXISTS idx_tertiary_qualifications_application_id
  ON public.tertiary_qualifications(application_id);

CREATE INDEX IF NOT EXISTS idx_tertiary_qualifications_certificate_document_id
  ON public.tertiary_qualifications(certificate_document_id);

CREATE INDEX IF NOT EXISTS idx_tertiary_qualifications_transcript_document_id
  ON public.tertiary_qualifications(transcript_document_id);
