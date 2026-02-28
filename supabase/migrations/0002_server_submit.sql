create sequence if not exists public.application_number_seq
  start with 1000000
  increment by 1
  minvalue 1000000;

create or replace function public.generate_application_number()
returns text
language sql
volatile
as $$
  select 'QX-' || nextval('public.application_number_seq')::text;
$$;

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

  if not public.is_allowed_company_user() then
    raise exception 'Your account is not allowed to submit this application.';
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

create or replace function public.submit_application(target_application_id uuid)
returns jsonb
language plpgsql
security invoker
as $$
declare
  missing_fields text[];
  submitted_row public.applications%rowtype;
begin
  missing_fields := public.application_submission_missing_fields(target_application_id);

  if coalesce(array_length(missing_fields, 1), 0) > 0 then
    raise exception 'Application submission failed: %', array_to_string(missing_fields, ' | ');
  end if;

  update public.applications
  set
    status = 'submitted',
    application_number = coalesce(application_number, public.generate_application_number()),
    submitted_at = coalesce(submitted_at, timezone('utc', now()))
  where id = target_application_id
    and user_id = auth.uid()
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
