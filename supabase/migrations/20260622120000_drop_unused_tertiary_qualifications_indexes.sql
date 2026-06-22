-- Drop unused indexes on tertiary_qualifications (never used; flagged by Supabase performance advisor, DIS-211)
DROP INDEX IF EXISTS public.idx_tertiary_qualifications_transcript_document_id;
DROP INDEX IF EXISTS public.idx_tertiary_qualifications_certificate_document_id;
