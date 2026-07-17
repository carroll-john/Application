do $$
begin
  if not exists (
    select 1
    from pg_enum
    where enumtypid = 'public.document_kind'::regtype
      and enumlabel = 'employment_letter'
  ) then
    alter type public.document_kind add value 'employment_letter';
  end if;
end
$$;

alter table public.applications
  add column if not exists work_experience_assessments jsonb not null default '{}'::jsonb;

alter table public.employment_experiences
  add column if not exists employer_letter_document_id uuid,
  add column if not exists employer_letter_document_name text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'employment_experiences_employer_letter_document_id_fkey'
  ) then
    alter table public.employment_experiences
      add constraint employment_experiences_employer_letter_document_id_fkey
      foreign key (employer_letter_document_id)
      references public.application_documents(id)
      on delete set null;
  end if;
end
$$;

create index if not exists idx_employment_experiences_employer_letter_document_id
  on public.employment_experiences(employer_letter_document_id);

