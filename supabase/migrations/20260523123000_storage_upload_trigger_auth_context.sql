-- Storage BEFORE INSERT triggers run before RLS and often without auth.uid().
-- Use the path owner segment (already validated when auth.uid() is present).

create or replace function public.enforce_application_storage_upload_limits()
returns trigger
language plpgsql
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

  perform public.check_application_storage_upload_limits(
    parsed.application_id,
    owner_user_id,
    object_prefix,
    new_object_bytes
  );

  return new;
end;
$$;
