-- Runs after the server-authoritative submission migration because this file
-- adds the MFA guard to the final submit_application definition.
-- Users who opt into MFA expect their applicant data to require the enrolled
-- factor. Browser gating improves the flow, while these restrictive policies
-- enforce the same rule for direct PostgREST and Storage requests.

create or replace function private.current_user_meets_mfa_requirement()
returns boolean
language sql
stable
security definer
set search_path = auth, pg_catalog
as $$
  select
    auth.uid() is not null
    and (
      coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (
        select 1
        from auth.mfa_factors factor
        where factor.user_id = auth.uid()
          and factor.status = 'verified'
      )
    );
$$;

-- RLS callers cannot read auth.mfa_factors directly in this project. This
-- private SECURITY DEFINER helper reveals only whether the current caller has
-- met their own factor requirement; it cannot inspect another user.
revoke all on function private.current_user_meets_mfa_requirement()
  from public, anon;
grant execute on function private.current_user_meets_mfa_requirement()
  to authenticated;

do $$
declare
  target_table text;
  target_tables text[] := array[
    'business_users',
    'applicant_profiles',
    'applications',
    'application_documents',
    'tertiary_qualifications',
    'employment_experiences',
    'professional_accreditations',
    'secondary_qualifications',
    'language_tests'
  ];
begin
  foreach target_table in array target_tables loop
    execute format(
      'drop policy if exists %I on public.%I',
      'Applicants with enrolled MFA require AAL2',
      target_table
    );

    execute format(
      $policy$
        create policy %I
        on public.%I
        as restrictive
        for all
        to authenticated
        using ((select private.current_user_meets_mfa_requirement()))
      $policy$,
      'Applicants with enrolled MFA require AAL2',
      target_table
    );
  end loop;
end
$$;

drop policy if exists "Applicants with enrolled MFA require AAL2"
  on storage.objects;
create policy "Applicants with enrolled MFA require AAL2"
on storage.objects
as restrictive
for all
to authenticated
using ((select private.current_user_meets_mfa_requirement()));

-- submit_application is SECURITY DEFINER and therefore bypasses table RLS. It
-- must repeat the opt-in MFA gate before reading or mutating an application.
create or replace function public.submit_application(target_application_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  caller_user_id uuid := auth.uid();
  missing_fields text[];
  submitted_row public.applications%rowtype;
begin
  if caller_user_id is null then
    raise exception 'Authentication is required to submit an application.';
  end if;

  if not private.current_user_meets_mfa_requirement() then
    raise exception using
      errcode = '42501',
      message = 'MFA_CHALLENGE_REQUIRED';
  end if;

  select application.*
  into submitted_row
  from public.applications application
  where application.id = target_application_id
    and application.user_id = caller_user_id
  for update;

  if not found then
    raise exception 'Application not found.';
  end if;

  if submitted_row.status = 'submitted' then
    return jsonb_build_object(
      'applicationId', submitted_row.id,
      'applicationNumber', submitted_row.application_number,
      'submittedAt', submitted_row.submitted_at
    );
  end if;

  missing_fields := public.application_submission_missing_fields(target_application_id);

  if coalesce(array_length(missing_fields, 1), 0) > 0 then
    raise exception 'Application submission failed: %', array_to_string(missing_fields, ' | ');
  end if;

  update public.applications
  set
    status = 'submitted',
    application_number = public.generate_application_number(),
    submitted_at = timezone('utc', now())
  where id = target_application_id
    and user_id = caller_user_id
    and status = 'draft'
  returning *
  into submitted_row;

  if not found then
    raise exception 'Application not found.';
  end if;

  return jsonb_build_object(
    'applicationId', submitted_row.id,
    'applicationNumber', submitted_row.application_number,
    'submittedAt', submitted_row.submitted_at
  );
end;
$$;

revoke all on function public.submit_application(uuid) from public, anon;
grant execute on function public.submit_application(uuid) to authenticated;
