create table if not exists public.business_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.applicant_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  first_name text,
  last_name text,
  preferred_name text,
  phone text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists applicant_profiles_owner_email_idx
  on public.applicant_profiles (owner_user_id, email);

alter table public.applications
  add column if not exists applicant_profile_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'applications_applicant_profile_id_fkey'
  ) then
    alter table public.applications
      add constraint applications_applicant_profile_id_fkey
      foreign key (applicant_profile_id)
      references public.applicant_profiles(id)
      on delete set null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'set_business_users_updated_at'
  ) then
    create trigger set_business_users_updated_at
    before update on public.business_users
    for each row
    execute function public.set_updated_at();
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'set_applicant_profiles_updated_at'
  ) then
    create trigger set_applicant_profiles_updated_at
    before update on public.applicant_profiles
    for each row
    execute function public.set_updated_at();
  end if;
end
$$;

alter table public.business_users enable row level security;
alter table public.applicant_profiles enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'business_users'
      and policyname = 'Allowed company users manage their own business user record'
  ) then
    create policy "Allowed company users manage their own business user record"
    on public.business_users
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
      and tablename = 'applicant_profiles'
      and policyname = 'Allowed company users manage their own applicant profiles'
  ) then
    create policy "Allowed company users manage their own applicant profiles"
    on public.applicant_profiles
    for all
    to authenticated
    using (public.is_allowed_company_user() and auth.uid() = owner_user_id)
    with check (
      public.is_allowed_company_user() and auth.uid() = owner_user_id
    );
  end if;
end
$$;

drop policy if exists "Users manage their own applications" on public.applications;

create policy "Users manage their own applications"
on public.applications
for all
to authenticated
using (
  public.is_allowed_company_user()
  and auth.uid() = user_id
  and (
    applicant_profile_id is null
    or exists (
      select 1
      from public.applicant_profiles applicant_profile
      where applicant_profile.id = applications.applicant_profile_id
        and applicant_profile.owner_user_id = auth.uid()
    )
  )
)
with check (
  public.is_allowed_company_user()
  and auth.uid() = user_id
  and (
    applicant_profile_id is null
    or exists (
      select 1
      from public.applicant_profiles applicant_profile
      where applicant_profile.id = applications.applicant_profile_id
        and applicant_profile.owner_user_id = auth.uid()
    )
  )
);
