create index if not exists applications_user_id_idx
  on public.applications (user_id);

create index if not exists application_documents_application_id_created_at_idx
  on public.application_documents (application_id, created_at desc);

create or replace function public.enforce_application_document_upload_limits()
returns trigger
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
  where app.id = new.application_id;

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
  where doc.application_id = new.application_id;

  if existing_document_count >= max_files_per_application then
    raise exception using
      message = 'UPLOAD_APP_FILE_COUNT_LIMIT',
      detail = format('max_files=%s', max_files_per_application);
  end if;

  if existing_total_bytes + new.size_bytes > max_total_bytes_per_application then
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

  return new;
end;
$$;

drop trigger if exists enforce_application_document_upload_limits
  on public.application_documents;

create trigger enforce_application_document_upload_limits
before insert on public.application_documents
for each row
execute function public.enforce_application_document_upload_limits();
