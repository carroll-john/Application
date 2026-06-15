-- Migration: Fix mutable search_path on public functions (security hardening)
-- Set search_path = public, pg_catalog on all affected functions so they cannot
-- be hijacked by a malicious object placed earlier in the search path.

ALTER FUNCTION public.set_updated_at()
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.generate_application_number()
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.application_submission_missing_fields(target_application_id uuid)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.submit_application(target_application_id uuid)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.storage_object_size_bytes(object_metadata jsonb)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.parse_application_document_storage_path(p_object_name text)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.application_document_is_ready(p_document_id uuid, p_application_id uuid)
  SET search_path = public, pg_catalog;
