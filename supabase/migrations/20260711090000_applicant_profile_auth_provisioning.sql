-- Codify the applicant-profile auth provisioning that prevents
-- applicant_profiles_owner_user_id_fkey (Postgres 23503) violations on the
-- /section2/qualifications save path (DIS-231).
--
-- applicant_profiles.owner_user_id is a NOT NULL FK to auth.users(id). The app
-- writes owner_user_id = session.user.id, so a row is only insertable once the
-- matching auth.users row exists AND has a provisioned profile. The trigger +
-- unique constraint below guarantee that for every auth user.
--
-- These objects already exist on the live database but were applied out-of-band
-- (they are not created by any migration, only referenced by a later grant
-- revoke). That drift means a fresh environment or a DB reset would come up
-- WITHOUT them and reintroduce the FK failure. This migration makes the repo the
-- source of truth. Every statement is idempotent, so re-running against an
-- environment that already has the objects is a no-op.

-- One applicant profile per auth user. Required by the ON CONFLICT clause in the
-- provisioning function and by the client upsert path.
create unique index if not exists applicant_profiles_owner_user_id_key
  on public.applicant_profiles (owner_user_id);

-- Auto-create the applicant profile whenever an auth user is created, so the
-- FK target is always present before the app writes application data.
create or replace function public.handle_new_auth_user()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public', 'pg_catalog'
as $function$
begin
  insert into public.applicant_profiles (
    id,
    owner_user_id,
    email,
    created_at,
    updated_at
  )
  values (
    gen_random_uuid(),
    new.id,
    coalesce(new.email, ''),
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (owner_user_id) do nothing;

  return new;
end;
$function$;

-- The function runs as its owner via the trigger; no client should call it
-- directly. Keep the same hardened grant posture as
-- 20260708021604_restrict_security_definer_rpc_execution.sql (idempotent here so
-- a fresh environment, where that migration's guard skips the not-yet-created
-- function, still ends up locked down).
revoke all on function public.handle_new_auth_user() from public;
revoke all on function public.handle_new_auth_user() from anon;
revoke all on function public.handle_new_auth_user() from authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user();

-- Self-heal any auth users that predate the trigger (or were created while it
-- was missing) so no existing account is left without a profile.
insert into public.applicant_profiles (
  id,
  owner_user_id,
  email,
  created_at,
  updated_at
)
select
  gen_random_uuid(),
  u.id,
  coalesce(u.email, ''),
  timezone('utc', now()),
  timezone('utc', now())
from auth.users u
where not exists (
  select 1
  from public.applicant_profiles p
  where p.owner_user_id = u.id
)
on conflict (owner_user_id) do nothing;
