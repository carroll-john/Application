create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'application_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.application_status as enum ('draft', 'submitted');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'document_kind'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.document_kind as enum (
      'cv',
      'tertiary_transcript',
      'tertiary_certificate',
      'accreditation_document',
      'language_test_document'
    );
  end if;
end
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.user_email_domain()
returns text
language sql
stable
as $$
  select lower(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 2));
$$;

create table if not exists public.allowed_email_domains (
  domain text primary key,
  created_at timestamptz not null default timezone('utc', now())
);

create or replace function public.is_allowed_company_user()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.allowed_email_domains domain
    where domain.domain = public.user_email_domain()
  );
$$;

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status public.application_status not null default 'draft',
  application_number text unique,
  course_code text not null,
  course_title text not null,
  intake_label text not null,
  personal_details jsonb not null default '{}'::jsonb,
  contact_details jsonb not null default '{}'::jsonb,
  cv_file_name text,
  cv_document_id uuid,
  submitted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  kind public.document_kind not null,
  storage_bucket text not null default 'application-documents',
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 5242880),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'applications_cv_document_id_fkey'
  ) then
    alter table public.applications
      add constraint applications_cv_document_id_fkey
      foreign key (cv_document_id)
      references public.application_documents(id)
      on delete set null;
  end if;
end
$$;

create table if not exists public.tertiary_qualifications (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  institution text not null,
  country text not null,
  level text not null,
  course_name text not null,
  start_month text not null,
  start_year text not null,
  completed boolean not null default false,
  end_month text not null,
  end_year text not null,
  transcript_document_name text,
  certificate_document_name text,
  transcript_document_id uuid references public.application_documents(id) on delete set null,
  certificate_document_id uuid references public.application_documents(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.employment_experiences (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  company text not null,
  position text not null,
  employment_type text not null,
  start_month text not null,
  start_year text not null,
  end_month text,
  end_year text,
  is_current_role boolean not null default false,
  duties text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.professional_accreditations (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  name text not null,
  status text not null,
  document_name text,
  document_id uuid references public.application_documents(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.secondary_qualifications (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  qualification_type text not null,
  country text not null,
  state text not null,
  school text not null,
  qualification_name text not null,
  completion_year text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.language_tests (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  test_type text not null,
  test_name text not null,
  completion_year text not null,
  document_name text,
  document_id uuid references public.application_documents(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_applications_updated_at') then
    create trigger set_applications_updated_at
    before update on public.applications
    for each row
    execute function public.set_updated_at();
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'set_application_documents_updated_at'
  ) then
    create trigger set_application_documents_updated_at
    before update on public.application_documents
    for each row
    execute function public.set_updated_at();
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'set_tertiary_qualifications_updated_at'
  ) then
    create trigger set_tertiary_qualifications_updated_at
    before update on public.tertiary_qualifications
    for each row
    execute function public.set_updated_at();
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'set_employment_experiences_updated_at'
  ) then
    create trigger set_employment_experiences_updated_at
    before update on public.employment_experiences
    for each row
    execute function public.set_updated_at();
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'set_professional_accreditations_updated_at'
  ) then
    create trigger set_professional_accreditations_updated_at
    before update on public.professional_accreditations
    for each row
    execute function public.set_updated_at();
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'set_secondary_qualifications_updated_at'
  ) then
    create trigger set_secondary_qualifications_updated_at
    before update on public.secondary_qualifications
    for each row
    execute function public.set_updated_at();
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'set_language_tests_updated_at'
  ) then
    create trigger set_language_tests_updated_at
    before update on public.language_tests
    for each row
    execute function public.set_updated_at();
  end if;
end
$$;

alter table public.allowed_email_domains enable row level security;
alter table public.applications enable row level security;
alter table public.application_documents enable row level security;
alter table public.tertiary_qualifications enable row level security;
alter table public.employment_experiences enable row level security;
alter table public.professional_accreditations enable row level security;
alter table public.secondary_qualifications enable row level security;
alter table public.language_tests enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'allowed_email_domains'
      and policyname = 'Allowed company users can read domains'
  ) then
    create policy "Allowed company users can read domains"
    on public.allowed_email_domains
    for select
    to authenticated
    using (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'applications'
      and policyname = 'Users manage their own applications'
  ) then
    create policy "Users manage their own applications"
    on public.applications
    for all
    to authenticated
    using (public.is_allowed_company_user() and auth.uid() = user_id)
    with check (public.is_allowed_company_user() and auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'application_documents'
      and policyname = 'Users manage documents for their own applications'
  ) then
    create policy "Users manage documents for their own applications"
    on public.application_documents
    for all
    to authenticated
    using (
      public.is_allowed_company_user()
      and exists (
        select 1
        from public.applications application
        where application.id = application_documents.application_id
          and application.user_id = auth.uid()
      )
    )
    with check (
      public.is_allowed_company_user()
      and exists (
        select 1
        from public.applications application
        where application.id = application_documents.application_id
          and application.user_id = auth.uid()
      )
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tertiary_qualifications'
      and policyname = 'Users manage tertiary qualifications for their own applications'
  ) then
    create policy "Users manage tertiary qualifications for their own applications"
    on public.tertiary_qualifications
    for all
    to authenticated
    using (
      public.is_allowed_company_user()
      and exists (
        select 1
        from public.applications application
        where application.id = tertiary_qualifications.application_id
          and application.user_id = auth.uid()
      )
    )
    with check (
      public.is_allowed_company_user()
      and exists (
        select 1
        from public.applications application
        where application.id = tertiary_qualifications.application_id
          and application.user_id = auth.uid()
      )
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'employment_experiences'
      and policyname = 'Users manage employment experiences for their own applications'
  ) then
    create policy "Users manage employment experiences for their own applications"
    on public.employment_experiences
    for all
    to authenticated
    using (
      public.is_allowed_company_user()
      and exists (
        select 1
        from public.applications application
        where application.id = employment_experiences.application_id
          and application.user_id = auth.uid()
      )
    )
    with check (
      public.is_allowed_company_user()
      and exists (
        select 1
        from public.applications application
        where application.id = employment_experiences.application_id
          and application.user_id = auth.uid()
      )
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'professional_accreditations'
      and policyname = 'Users manage accreditations for their own applications'
  ) then
    create policy "Users manage accreditations for their own applications"
    on public.professional_accreditations
    for all
    to authenticated
    using (
      public.is_allowed_company_user()
      and exists (
        select 1
        from public.applications application
        where application.id = professional_accreditations.application_id
          and application.user_id = auth.uid()
      )
    )
    with check (
      public.is_allowed_company_user()
      and exists (
        select 1
        from public.applications application
        where application.id = professional_accreditations.application_id
          and application.user_id = auth.uid()
      )
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'secondary_qualifications'
      and policyname = 'Users manage secondary qualifications for their own applications'
  ) then
    create policy "Users manage secondary qualifications for their own applications"
    on public.secondary_qualifications
    for all
    to authenticated
    using (
      public.is_allowed_company_user()
      and exists (
        select 1
        from public.applications application
        where application.id = secondary_qualifications.application_id
          and application.user_id = auth.uid()
      )
    )
    with check (
      public.is_allowed_company_user()
      and exists (
        select 1
        from public.applications application
        where application.id = secondary_qualifications.application_id
          and application.user_id = auth.uid()
      )
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'language_tests'
      and policyname = 'Users manage language tests for their own applications'
  ) then
    create policy "Users manage language tests for their own applications"
    on public.language_tests
    for all
    to authenticated
    using (
      public.is_allowed_company_user()
      and exists (
        select 1
        from public.applications application
        where application.id = language_tests.application_id
          and application.user_id = auth.uid()
      )
    )
    with check (
      public.is_allowed_company_user()
      and exists (
        select 1
        from public.applications application
        where application.id = language_tests.application_id
          and application.user_id = auth.uid()
      )
    );
  end if;
end
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'application-documents',
  'application-documents',
  false,
  5242880,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users manage their own application document objects'
  ) then
    create policy "Users manage their own application document objects"
    on storage.objects
    for all
    to authenticated
    using (
      bucket_id = 'application-documents'
      and public.is_allowed_company_user()
      and (storage.foldername(name))[1] = auth.uid()::text
    )
    with check (
      bucket_id = 'application-documents'
      and public.is_allowed_company_user()
      and (storage.foldername(name))[1] = auth.uid()::text
    );
  end if;
end
$$;
