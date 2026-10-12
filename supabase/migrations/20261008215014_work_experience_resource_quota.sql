-- Server-only capacity reservations. Fixed units conservatively cover the initial
-- and retry attempts; input/output bounds in the route make each unit bounded.
-- 20 assessments/user/minute; 500 assessments/project/24 hours. These are hard
-- capacity ceilings, not a currency estimate. Never refund ambiguous failures.
create table public.work_experience_quota (
  quota_key text primary key,
  window_started_at timestamptz not null,
  reserved_attempts integer not null check (reserved_attempts >= 0)
);
alter table public.work_experience_quota enable row level security;
revoke all on public.work_experience_quota from public, anon, authenticated;
grant select, insert, update, delete on public.work_experience_quota to service_role;

create function public.reserve_work_experience_quota(p_user_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
set lock_timeout = '2s'
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_project public.work_experience_quota%rowtype;
  v_user public.work_experience_quota%rowtype;
  v_user_key text := 'user:' || p_user_id::text;
begin
  if p_user_id is null then raise exception 'User required'; end if;
  -- Every transaction locks the project row first, then the user row. This
  -- serializes cross-instance reservations without a check/update race.
  insert into public.work_experience_quota values ('project', v_now, 0)
    on conflict do nothing;
  select * into v_project from public.work_experience_quota
    where quota_key = 'project' for update;
  -- Read the clock after acquiring the lock, not before a possible wait.
  v_now := clock_timestamp();
  if v_project.window_started_at <= v_now - interval '24 hours' then
    v_project.window_started_at := v_now;
    v_project.reserved_attempts := 0;
  end if;
  if v_project.reserved_attempts + 2 > 1000 then return false; end if;

  insert into public.work_experience_quota values (v_user_key, v_now, 0)
    on conflict do nothing;
  select * into v_user from public.work_experience_quota
    where quota_key = v_user_key for update;
  if v_user.window_started_at <= v_now - interval '1 minute' then
    v_user.window_started_at := v_now;
    v_user.reserved_attempts := 0;
  end if;
  if v_user.reserved_attempts + 2 > 40 then return false; end if;
  update public.work_experience_quota set
    window_started_at = v_project.window_started_at,
    reserved_attempts = v_project.reserved_attempts + 2
    where quota_key = 'project';
  update public.work_experience_quota set
    window_started_at = v_user.window_started_at,
    reserved_attempts = v_user.reserved_attempts + 2
    where quota_key = v_user_key;
  -- Bounded retention; at most the principals within the daily project budget
  -- accumulate new rows. Expired user rows cannot affect a new reservation.
  delete from public.work_experience_quota
    where quota_key <> 'project' and window_started_at < v_now - interval '24 hours';
  return true;
end;
$$;
revoke all on function public.reserve_work_experience_quota(uuid) from public, anon, authenticated;
grant execute on function public.reserve_work_experience_quota(uuid) to service_role;
