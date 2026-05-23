-- Storage and document upload limit checks must read applications and
-- storage.objects without being blocked by RLS in trigger context.

create or replace function public.check_application_upload_limits(
  p_application_id uuid,
  p_new_bytes bigint
)
returns void
language plpgsql
security definer
set search_path = public
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

create or replace function public.check_application_storage_upload_limits(
  p_application_id uuid,
  p_owner_user_id uuid,
  p_object_prefix text,
  p_new_bytes bigint
)
returns void
language plpgsql
security definer
set search_path = public, storage
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
