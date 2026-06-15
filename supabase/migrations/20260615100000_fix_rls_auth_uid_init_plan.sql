-- Migration: Fix Auth RLS Initialization Plan warnings
-- Replace bare auth.uid() with (SELECT auth.uid()) in all affected policies
-- so the planner evaluates it once per query, not once per row.

-- business_users
DROP POLICY IF EXISTS "Users manage their own business user record" ON public.business_users;
CREATE POLICY "Users manage their own business user record"
  ON public.business_users
  FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- applicant_profiles
DROP POLICY IF EXISTS "Users manage their own applicant profiles" ON public.applicant_profiles;
CREATE POLICY "Users manage their own applicant profiles"
  ON public.applicant_profiles
  FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = owner_user_id)
  WITH CHECK ((SELECT auth.uid()) = owner_user_id);

-- applications
DROP POLICY IF EXISTS "Users manage their own applications" ON public.applications;
CREATE POLICY "Users manage their own applications"
  ON public.applications
  FOR ALL
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    AND (
      applicant_profile_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM applicant_profiles applicant_profile
        WHERE applicant_profile.id = applications.applicant_profile_id
          AND applicant_profile.owner_user_id = (SELECT auth.uid())
      )
    )
  )
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND (
      applicant_profile_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM applicant_profiles applicant_profile
        WHERE applicant_profile.id = applications.applicant_profile_id
          AND applicant_profile.owner_user_id = (SELECT auth.uid())
      )
    )
  );

-- application_documents
DROP POLICY IF EXISTS "Users manage documents for their own applications" ON public.application_documents;
CREATE POLICY "Users manage documents for their own applications"
  ON public.application_documents
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM applications application
      WHERE application.id = application_documents.application_id
        AND application.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM applications application
      WHERE application.id = application_documents.application_id
        AND application.user_id = (SELECT auth.uid())
    )
  );

-- tertiary_qualifications
DROP POLICY IF EXISTS "Users manage tertiary qualifications for their own applications" ON public.tertiary_qualifications;
CREATE POLICY "Users manage tertiary qualifications for their own applications"
  ON public.tertiary_qualifications
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM applications application
      WHERE application.id = tertiary_qualifications.application_id
        AND application.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM applications application
      WHERE application.id = tertiary_qualifications.application_id
        AND application.user_id = (SELECT auth.uid())
    )
  );

-- employment_experiences
DROP POLICY IF EXISTS "Users manage employment experiences for their own applications" ON public.employment_experiences;
CREATE POLICY "Users manage employment experiences for their own applications"
  ON public.employment_experiences
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM applications application
      WHERE application.id = employment_experiences.application_id
        AND application.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM applications application
      WHERE application.id = employment_experiences.application_id
        AND application.user_id = (SELECT auth.uid())
    )
  );

-- professional_accreditations
DROP POLICY IF EXISTS "Users manage accreditations for their own applications" ON public.professional_accreditations;
CREATE POLICY "Users manage accreditations for their own applications"
  ON public.professional_accreditations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM applications application
      WHERE application.id = professional_accreditations.application_id
        AND application.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM applications application
      WHERE application.id = professional_accreditations.application_id
        AND application.user_id = (SELECT auth.uid())
    )
  );

-- secondary_qualifications
DROP POLICY IF EXISTS "Users manage secondary qualifications for their own application" ON public.secondary_qualifications;
CREATE POLICY "Users manage secondary qualifications for their own application"
  ON public.secondary_qualifications
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM applications application
      WHERE application.id = secondary_qualifications.application_id
        AND application.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM applications application
      WHERE application.id = secondary_qualifications.application_id
        AND application.user_id = (SELECT auth.uid())
    )
  );

-- language_tests
DROP POLICY IF EXISTS "Users manage language tests for their own applications" ON public.language_tests;
CREATE POLICY "Users manage language tests for their own applications"
  ON public.language_tests
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM applications application
      WHERE application.id = language_tests.application_id
        AND application.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM applications application
      WHERE application.id = language_tests.application_id
        AND application.user_id = (SELECT auth.uid())
    )
  );
