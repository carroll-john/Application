-- DIS-116 / DIS-127: trigger wrappers must not remain callable RPC endpoints in public.

create or replace function private.enforce_application_document_upload_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform private.check_application_upload_limits(new.application_id, new.size_bytes);
  return new;
end;
$$;

create or replace function private.enforce_application_storage_upload_limits()
returns trigger
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  parsed record;
  new_object_bytes bigint;
  object_prefix text;
  owner_user_id uuid;
begin
  if new.bucket_id <> 'application-documents' then
    return new;
  end if;

  select *
  into parsed
  from public.parse_application_document_storage_path(new.name);

  owner_user_id := parsed.owner_user_id::uuid;

  if auth.uid() is not null and parsed.owner_user_id <> auth.uid()::text then
    raise exception using
      message = 'UPLOAD_STORAGE_OWNER_MISMATCH';
  end if;

  object_prefix := format('%s/%s/', parsed.owner_user_id, parsed.application_id);
  new_object_bytes := public.storage_object_size_bytes(new.metadata);

  perform private.check_application_storage_upload_limits(
    parsed.application_id,
    owner_user_id,
    object_prefix,
    new_object_bytes
  );

  return new;
end;
$$;

revoke all on function private.enforce_application_document_upload_limits() from public, anon, authenticated;
revoke all on function private.enforce_application_storage_upload_limits() from public, anon, authenticated;

drop trigger if exists enforce_application_document_upload_limits
  on public.application_documents;

create trigger enforce_application_document_upload_limits
before insert on public.application_documents
for each row
execute function private.enforce_application_document_upload_limits();

drop trigger if exists enforce_application_storage_upload_limits on storage.objects;

create trigger enforce_application_storage_upload_limits
before insert on storage.objects
for each row
execute function private.enforce_application_storage_upload_limits();

drop function if exists public.enforce_application_document_upload_limits();
drop function if exists public.enforce_application_storage_upload_limits();
