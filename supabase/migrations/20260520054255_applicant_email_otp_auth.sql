drop policy if exists "Allowed company users can read domains"
  on public.allowed_email_domains;

drop policy if exists "Allowed company users manage their own business user record"
  on public.business_users;

create policy "Users manage their own business user record"
on public.business_users
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Allowed company users manage their own applicant profiles"
  on public.applicant_profiles;

create policy "Users manage their own applicant profiles"
on public.applicant_profiles
for all
to authenticated
using (auth.uid() = owner_user_id)
with check (auth.uid() = owner_user_id);

drop policy if exists "Users manage their own applications"
  on public.applications;

create policy "Users manage their own applications"
on public.applications
for all
to authenticated
using (
  auth.uid() = user_id
  and (
    applicant_profile_id is null
    or exists (
      select 1
      from public.applicant_profiles applicant_profile
      where applicant_profile.id = applications.applicant_profile_id
        and applicant_profile.owner_user_id = auth.uid()
    )
  )
)
with check (
  auth.uid() = user_id
  and (
    applicant_profile_id is null
    or exists (
      select 1
      from public.applicant_profiles applicant_profile
      where applicant_profile.id = applications.applicant_profile_id
        and applicant_profile.owner_user_id = auth.uid()
    )
  )
);

drop policy if exists "Users manage documents for their own applications"
  on public.application_documents;

create policy "Users manage documents for their own applications"
on public.application_documents
for all
to authenticated
using (
  exists (
    select 1
    from public.applications application
    where application.id = application_documents.application_id
      and application.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.applications application
    where application.id = application_documents.application_id
      and application.user_id = auth.uid()
  )
);

drop policy if exists "Users manage tertiary qualifications for their own applications"
  on public.tertiary_qualifications;

create policy "Users manage tertiary qualifications for their own applications"
on public.tertiary_qualifications
for all
to authenticated
using (
  exists (
    select 1
    from public.applications application
    where application.id = tertiary_qualifications.application_id
      and application.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.applications application
    where application.id = tertiary_qualifications.application_id
      and application.user_id = auth.uid()
  )
);

drop policy if exists "Users manage employment experiences for their own applications"
  on public.employment_experiences;

create policy "Users manage employment experiences for their own applications"
on public.employment_experiences
for all
to authenticated
using (
  exists (
    select 1
    from public.applications application
    where application.id = employment_experiences.application_id
      and application.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.applications application
    where application.id = employment_experiences.application_id
      and application.user_id = auth.uid()
  )
);

drop policy if exists "Users manage accreditations for their own applications"
  on public.professional_accreditations;

create policy "Users manage accreditations for their own applications"
on public.professional_accreditations
for all
to authenticated
using (
  exists (
    select 1
    from public.applications application
    where application.id = professional_accreditations.application_id
      and application.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.applications application
    where application.id = professional_accreditations.application_id
      and application.user_id = auth.uid()
  )
);

drop policy if exists "Users manage secondary qualifications for their own applications"
  on public.secondary_qualifications;

create policy "Users manage secondary qualifications for their own applications"
on public.secondary_qualifications
for all
to authenticated
using (
  exists (
    select 1
    from public.applications application
    where application.id = secondary_qualifications.application_id
      and application.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.applications application
    where application.id = secondary_qualifications.application_id
      and application.user_id = auth.uid()
  )
);

drop policy if exists "Users manage language tests for their own applications"
  on public.language_tests;

create policy "Users manage language tests for their own applications"
on public.language_tests
for all
to authenticated
using (
  exists (
    select 1
    from public.applications application
    where application.id = language_tests.application_id
      and application.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.applications application
    where application.id = language_tests.application_id
      and application.user_id = auth.uid()
  )
);

drop policy if exists "Users manage their own application document objects"
  on storage.objects;

create policy "Users manage their own application document objects"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'application-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'application-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create or replace function public.application_submission_missing_fields(
  target_application_id uuid
)
returns text[]
language plpgsql
security invoker
as $$
declare
  application_row public.applications%rowtype;
  missing_fields text[] := array[]::text[];
  parent_count integer := 0;
  parent_index integer;
  tertiary_row record;
  tertiary_count integer := 0;
  employment_count integer := 0;
  cv_uploaded boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to submit an application.';
  end if;

  select *
  into application_row
  from public.applications
  where id = target_application_id
    and user_id = auth.uid();

  if not found then
    raise exception 'Application not found.';
  end if;

  if coalesce(trim(application_row.personal_details ->> 'title'), '') = '' then
    missing_fields := array_append(missing_fields, 'Title');
  end if;
  if coalesce(trim(application_row.personal_details ->> 'firstName'), '') = '' then
    missing_fields := array_append(missing_fields, 'First name');
  end if;
  if coalesce(trim(application_row.personal_details ->> 'lastName'), '') = '' then
    missing_fields := array_append(missing_fields, 'Last name');
  end if;
  if coalesce(trim(application_row.personal_details ->> 'gender'), '') = '' then
    missing_fields := array_append(missing_fields, 'Gender');
  end if;
  if coalesce(trim(application_row.personal_details ->> 'dateOfBirth'), '') = '' then
    missing_fields := array_append(missing_fields, 'Date of birth');
  end if;
  if coalesce(trim(application_row.personal_details ->> 'email'), '') = '' then
    missing_fields := array_append(missing_fields, 'Email address');
  end if;
  if coalesce(trim(application_row.personal_details ->> 'phone'), '') = '' then
    missing_fields := array_append(missing_fields, 'Phone number');
  end if;

  if coalesce(trim(application_row.contact_details ->> 'citizenshipStatus'), '') = '' then
    missing_fields := array_append(missing_fields, 'Citizenship status');
  end if;
  if coalesce(
    trim(application_row.contact_details #>> '{residentialAddress,formattedAddress}'),
    ''
  ) = '' then
    missing_fields := array_append(missing_fields, 'Permanent residential address');
  end if;
  if coalesce(trim(application_row.contact_details ->> 'language'), '') = '' then
    missing_fields := array_append(missing_fields, 'Language spoken');
  end if;
  if coalesce(trim(application_row.contact_details ->> 'aboriginal'), '') = '' then
    missing_fields := array_append(
      missing_fields,
      'Aboriginal or Torres Strait Islander status'
    );
  end if;
  if coalesce(trim(application_row.contact_details ->> 'schoolLevel'), '') = '' then
    missing_fields := array_append(missing_fields, 'School level');
  end if;

  begin
    parent_count := coalesce(nullif(application_row.contact_details ->> 'parentsCount', '')::integer, 0);
  exception
    when others then
      parent_count := 0;
  end;

  for parent_index in 1..least(parent_count, 5) loop
    if coalesce(
      trim(application_row.contact_details ->> format('parent%sDetails', parent_index)),
      ''
    ) = '' then
      missing_fields := array_append(
        missing_fields,
        format('Parent/Guardian %s Education Level', parent_index)
      );
    end if;
  end loop;

  select count(*)
  into tertiary_count
  from public.tertiary_qualifications
  where application_id = target_application_id;

  select count(*)
  into employment_count
  from public.employment_experiences
  where application_id = target_application_id;

  cv_uploaded := application_row.cv_document_id is not null
    or coalesce(trim(application_row.cv_file_name), '') <> '';

  if tertiary_count = 0 and not (cv_uploaded and employment_count > 0) then
    if not cv_uploaded then
      missing_fields := array_append(
        missing_fields,
        'CV upload or a tertiary qualification'
      );
    end if;
    if employment_count = 0 then
      missing_fields := array_append(
        missing_fields,
        'Employment experience or a tertiary qualification'
      );
    end if;
  end if;

  for tertiary_row in
    select
      course_name,
      completed,
      transcript_document_id,
      transcript_document_name,
      certificate_document_id,
      certificate_document_name
    from public.tertiary_qualifications
    where application_id = target_application_id
    order by created_at asc
  loop
    if tertiary_row.transcript_document_id is null
      and coalesce(trim(tertiary_row.transcript_document_name), '') = '' then
      missing_fields := array_append(
        missing_fields,
        format('Qualification "%s": Academic Transcript', tertiary_row.course_name)
      );
    end if;

    if tertiary_row.completed
      and tertiary_row.certificate_document_id is null
      and coalesce(trim(tertiary_row.certificate_document_name), '') = '' then
      missing_fields := array_append(
        missing_fields,
        format('Qualification "%s": Certificate of Completion', tertiary_row.course_name)
      );
    end if;
  end loop;

  return missing_fields;
end;
$$;

drop function if exists public.is_allowed_company_user();
drop function if exists public.user_email_domain();
drop table if exists public.allowed_email_domains;
