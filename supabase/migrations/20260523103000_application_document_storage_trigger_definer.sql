-- Allow document metadata inserts to verify storage.objects even when RLS would
-- hide rows from the inserting user's trigger context.

create or replace function public.enforce_application_document_storage_exists()
returns trigger
language plpgsql
security definer
set search_path = public, storage
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
