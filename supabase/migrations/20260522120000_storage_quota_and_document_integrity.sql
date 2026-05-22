-- Security hardening: storage-object quotas, metadata/storage integrity, submission document checks.
-- Manual regression checklist: docs/security-regression.md

create or replace function public.check_application_upload_limits(
  p_application_id uuid,
  p_new_bytes bigint
)
returns void
language plpgsql
as $$
declare
  owner_user_id uuid;
  existing_document_count integer;
  existing_total_bytes bigint;
  uploads_in_window integer;
  max_files_per_application constant integer := 30;
  max_total_bytes_per_application constant bigint := 104857600;
  max_uploads_per_window constant integer := 20;
  upload_window_minutes constant integer := 10;
begin
  select app.user_id
  into owner_user_id
  from public.applications app
  where app.id = p_application_id;

  if owner_user_id is null then
    raise exception using
      message = 'UPLOAD_APPLICATION_NOT_FOUND';
  end if;

  select
    count(*),
    coalesce(sum(doc.size_bytes), 0)
  into
    existing_document_count,
    existing_total_bytes
  from public.application_documents doc
  where doc.application_id = p_application_id;

  if existing_document_count >= max_files_per_application then
    raise exception using
      message = 'UPLOAD_APP_FILE_COUNT_LIMIT',
      detail = format('max_files=%s', max_files_per_application);
  end if;

  if existing_total_bytes + coalesce(p_new_bytes, 0) > max_total_bytes_per_application then
    raise exception using
      message = 'UPLOAD_APP_TOTAL_BYTES_LIMIT',
      detail = format('max_bytes=%s', max_total_bytes_per_application);
  end if;

  select count(*)
  into uploads_in_window
  from public.application_documents doc
  join public.applications app
    on app.id = doc.application_id
  where app.user_id = owner_user_id
    and doc.created_at >=
      timezone('utc', now()) - make_interval(mins => upload_window_minutes);

  if uploads_in_window >= max_uploads_per_window then
    raise exception using
      message = 'UPLOAD_RATE_LIMIT',
      detail = format(
        'max_uploads=%s;window_minutes=%s',
        max_uploads_per_window,
        upload_window_minutes
      );
  end if;
end;
$$;

create or replace function public.enforce_application_document_upload_limits()
returns trigger
language plpgsql
as $$
begin
  perform public.check_application_upload_limits(new.application_id, new.size_bytes);
  return new;
end;
$$;

create or replace function public.storage_object_size_bytes(object_metadata jsonb)
returns bigint
language sql
immutable
as $$
  select coalesce(nullif(object_metadata ->> 'size', '')::bigint, 0);
$$;

create or replace function public.parse_application_document_storage_path(p_object_name text)
returns table (
  owner_user_id text,
  application_id uuid,
  document_kind text
)
language plpgsql
as $$
declare
  path_parts text[];
begin
  path_parts := string_to_array(p_object_name, '/');

  if coalesce(array_length(path_parts, 1), 0) < 4 then
    raise exception using
      message = 'UPLOAD_INVALID_STORAGE_PATH';
  end if;

  owner_user_id := path_parts[1];
  application_id := path_parts[2]::uuid;
  document_kind := path_parts[3];
  return next;
end;
$$;

create or replace function public.check_application_storage_upload_limits(
  p_application_id uuid,
  p_owner_user_id uuid,
  p_object_prefix text,
  p_new_bytes bigint
)
returns void
language plpgsql
as $$
declare
  existing_object_count integer;
  existing_total_bytes bigint;
  uploads_in_window integer;
  max_files_per_application constant integer := 30;
  max_total_bytes_per_application constant bigint := 104857600;
  max_uploads_per_window constant integer := 20;
  upload_window_minutes constant integer := 10;
begin
  if not exists (
    select 1
    from public.applications application
    where application.id = p_application_id
      and application.user_id = p_owner_user_id
  ) then
    raise exception using
      message = 'UPLOAD_APPLICATION_NOT_FOUND';
  end if;

  select
    count(*),
    coalesce(sum(public.storage_object_size_bytes(obj.metadata)), 0)
  into
    existing_object_count,
    existing_total_bytes
  from storage.objects obj
  where obj.bucket_id = 'application-documents'
    and obj.name like p_object_prefix || '%';

  if existing_object_count >= max_files_per_application then
    raise exception using
      message = 'UPLOAD_APP_FILE_COUNT_LIMIT',
      detail = format('max_files=%s', max_files_per_application);
  end if;

  if existing_total_bytes + coalesce(p_new_bytes, 0) > max_total_bytes_per_application then
    raise exception using
      message = 'UPLOAD_APP_TOTAL_BYTES_LIMIT',
      detail = format('max_bytes=%s', max_total_bytes_per_application);
  end if;

  select count(*)
  into uploads_in_window
  from storage.objects obj
  where obj.bucket_id = 'application-documents'
    and (storage.foldername(obj.name))[1] = p_owner_user_id::text
    and obj.created_at >=
      timezone('utc', now()) - make_interval(mins => upload_window_minutes);

  if uploads_in_window >= max_uploads_per_window then
    raise exception using
      message = 'UPLOAD_RATE_LIMIT',
      detail = format(
        'max_uploads=%s;window_minutes=%s',
        max_uploads_per_window,
        upload_window_minutes
      );
  end if;
end;
$$;

create or replace function public.enforce_application_storage_upload_limits()
returns trigger
language plpgsql
as $$
declare
  parsed record;
  new_object_bytes bigint;
  object_prefix text;
begin
  if new.bucket_id <> 'application-documents' then
    return new;
  end if;

  select *
  into parsed
  from public.parse_application_document_storage_path(new.name);

  if parsed.owner_user_id <> auth.uid()::text then
    raise exception using
      message = 'UPLOAD_STORAGE_OWNER_MISMATCH';
  end if;

  object_prefix := format('%s/%s/', parsed.owner_user_id, parsed.application_id);
  new_object_bytes := public.storage_object_size_bytes(new.metadata);

  perform public.check_application_storage_upload_limits(
    parsed.application_id,
    auth.uid(),
    object_prefix,
    new_object_bytes
  );

  return new;
end;
$$;

drop trigger if exists enforce_application_storage_upload_limits on storage.objects;

create trigger enforce_application_storage_upload_limits
before insert on storage.objects
for each row
execute function public.enforce_application_storage_upload_limits();

create or replace function public.enforce_application_document_storage_exists()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from storage.objects obj
    where obj.bucket_id = new.storage_bucket
      and obj.name = new.storage_path
  ) then
    raise exception using
      message = 'DOCUMENT_STORAGE_OBJECT_MISSING';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_application_document_storage_exists
  on public.application_documents;

create trigger enforce_application_document_storage_exists
before insert on public.application_documents
for each row
execute function public.enforce_application_document_storage_exists();

create or replace function public.application_document_is_ready(
  p_document_id uuid,
  p_application_id uuid
)
returns boolean
language sql
stable
security invoker
as $$
  select exists (
    select 1
    from public.application_documents doc
    join storage.objects obj
      on obj.bucket_id = doc.storage_bucket
      and obj.name = doc.storage_path
    where doc.id = p_document_id
      and doc.application_id = p_application_id
  );
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

  cv_uploaded := public.application_document_is_ready(
    application_row.cv_document_id,
    target_application_id
  );

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
      certificate_document_id
    from public.tertiary_qualifications
    where application_id = target_application_id
    order by created_at asc
  loop
    if not public.application_document_is_ready(
      tertiary_row.transcript_document_id,
      target_application_id
    ) then
      missing_fields := array_append(
        missing_fields,
        format('Qualification "%s": Academic Transcript', tertiary_row.course_name)
      );
    end if;

    if tertiary_row.completed
      and not public.application_document_is_ready(
        tertiary_row.certificate_document_id,
        target_application_id
      ) then
      missing_fields := array_append(
        missing_fields,
        format('Qualification "%s": Certificate of Completion', tertiary_row.course_name)
      );
    end if;
  end loop;

  return missing_fields;
end;
$$;
