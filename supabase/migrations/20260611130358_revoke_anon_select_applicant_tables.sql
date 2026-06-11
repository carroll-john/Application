-- DIS-117: hide applicant/application tables from the anon GraphQL schema.
-- https://supabase.com/docs/guides/database/database-linter?lint=0026_pg_graphql_anon_table_exposed

revoke select on table public.applicant_profiles from anon;
revoke select on table public.application_documents from anon;
revoke select on table public.applications from anon;
revoke select on table public.business_users from anon;
revoke select on table public.employment_experiences from anon;
revoke select on table public.language_tests from anon;
revoke select on table public.professional_accreditations from anon;
revoke select on table public.secondary_qualifications from anon;
revoke select on table public.tertiary_qualifications from anon;
