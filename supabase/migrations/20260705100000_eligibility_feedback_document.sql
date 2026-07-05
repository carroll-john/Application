do $$
begin
  if not exists (
    select 1
    from pg_enum
    join pg_type on pg_type.oid = pg_enum.enumtypid
    where pg_type.typname = 'document_kind'
      and pg_enum.enumlabel = 'eligibility_feedback'
  ) then
    alter type public.document_kind add value 'eligibility_feedback';
  end if;
end
$$;

alter table public.applications
  add column if not exists eligibility_feedback_document_id uuid,
  add column if not exists eligibility_feedback_file_name text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'applications_eligibility_feedback_document_id_fkey'
  ) then
    alter table public.applications
      add constraint applications_eligibility_feedback_document_id_fkey
      foreign key (eligibility_feedback_document_id)
      references public.application_documents(id)
      on delete set null;
  end if;
end
$$;

create index if not exists idx_applications_eligibility_feedback_document_id
  on public.applications(eligibility_feedback_document_id);
