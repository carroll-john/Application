-- DIS-128: hide applicant/application tables from authenticated GraphQL introspection.
-- https://supabase.com/docs/guides/database/database-linter?lint=0027_pg_graphql_authenticated_table_exposed
--
-- The frontend uses PostgREST via supabase-js, not /graphql/v1. Applicant tables must
-- keep SELECT for the authenticated role so RLS-backed REST access continues to work;
-- revoking table SELECT would break remoteStore and related client queries.
-- Dropping pg_graphql removes schema exposure for signed-in users without affecting REST.

drop extension if exists pg_graphql;
