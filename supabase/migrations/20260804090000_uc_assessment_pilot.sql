-- Isolated UC assessment pilot persistence. This migration is for the separate
-- pilot Supabase project only; never apply it to the frozen UC demo project.

create type public.assessment_cohort as enum ('control', 'treatment');
create type public.assessment_session_status as enum (
  'cv_review', 'shortlist', 'transcript', 'evaluated',
  'application_started', 'abandoned'
);
create type public.assessment_document_status as enum (
  'quarantined', 'scanning', 'passed', 'rejected', 'promoted'
);
create type public.assessment_review_status as enum (
  'unassigned', 'in_review', 'agreed', 'corrected', 'exported'
);

create table public.pilot_participants (
  id uuid primary key default gen_random_uuid(),
  partner_id text not null,
  email_hash text not null,
  invitation_token_hash text not null unique,
  invited_user_id uuid references auth.users(id) on delete set null,
  cohort public.assessment_cohort,
  activated_at timestamptz,
  expires_at timestamptz not null,
  disabled_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (partner_id, email_hash)
);

create table public.assessment_sessions (
  id uuid primary key default gen_random_uuid(),
  partner_id text not null,
  participant_id uuid not null references public.pilot_participants(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  cohort public.assessment_cohort not null,
  status public.assessment_session_status not null default 'cv_review',
  catalogue_id text not null,
  catalogue_version text not null,
  rules_version text not null,
  model_version text not null,
  shortlist_course_codes text[] not null default '{}',
  confirmed_cv jsonb,
  transcript_assessment jsonb,
  application_id uuid,
  completed_at timestamptz,
  expires_at timestamptz not null default (timezone('utc', now()) + interval '30 days'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (participant_id),
  unique (id, partner_id)
);

create table public.assessment_results (
  id uuid primary key default gen_random_uuid(),
  partner_id text not null,
  assessment_session_id uuid not null references public.assessment_sessions(id) on delete cascade,
  course_code text not null,
  potential_credit_points integer,
  published_cap integer,
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  matched_transcript_evidence jsonb not null default '[]'::jsonb,
  manual_review_reasons jsonb not null default '[]'::jsonb,
  catalogue_version text not null,
  rules_version text not null,
  model_version text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (assessment_session_id, course_code),
  check (
    potential_credit_points is null
    or (
      potential_credit_points > 0
      and published_cap is not null
      and potential_credit_points <= published_cap
    )
  )
);

create table public.assessment_documents (
  id uuid primary key default gen_random_uuid(),
  partner_id text not null,
  assessment_session_id uuid not null references public.assessment_sessions(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('cv', 'tertiary_transcript')),
  scan_status public.assessment_document_status not null default 'quarantined',
  storage_bucket text not null default 'assessment-quarantine',
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 5242880),
  sha256 text not null,
  scan_provider text,
  scan_reference text,
  scanned_at timestamptz,
  rejection_reason text,
  promoted_application_document_id uuid references public.application_documents(id) on delete set null,
  promoted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (assessment_session_id, kind, sha256)
);

create table public.staff_roles (
  id uuid primary key default gen_random_uuid(),
  partner_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('reviewer', 'review_manager')),
  active boolean not null default true,
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (partner_id, user_id)
);

create table public.assessment_reviews (
  id uuid primary key default gen_random_uuid(),
  partner_id text not null,
  assessment_session_id uuid not null unique references public.assessment_sessions(id) on delete cascade,
  status public.assessment_review_status not null default 'unassigned',
  assigned_to uuid references auth.users(id) on delete set null,
  correction_category text check (
    correction_category is null or correction_category in (
      'evidence_mapping', 'credit_band', 'confidence', 'manual_review', 'other'
    )
  ),
  corrected_credit_points integer,
  private_notes text,
  claimed_at timestamptz,
  reviewed_at timestamptz,
  exported_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (corrected_credit_points is null or corrected_credit_points >= 0)
);

create table public.assessment_audit_events (
  id bigint generated always as identity primary key,
  partner_id text not null,
  assessment_session_id uuid references public.assessment_sessions(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  request_id text not null,
  ip_hash text,
  user_agent_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.assessment_rate_limits (
  key_hash text not null,
  window_started_at timestamptz not null,
  hit_count integer not null default 1,
  expires_at timestamptz not null,
  primary key (key_hash, window_started_at)
);

alter table public.applications
  add column partner_id text,
  add column catalogue_id text,
  add column catalogue_version text,
  add column assessment_rules_version text,
  add column assessment_model_version text,
  add column assessment_session_id uuid;

alter table public.applications
  add constraint applications_assessment_session_id_fkey
  foreign key (assessment_session_id)
  references public.assessment_sessions(id)
  on delete set null;

alter table public.assessment_sessions
  add constraint assessment_sessions_application_id_fkey
  foreign key (application_id)
  references public.applications(id)
  on delete set null;

create unique index applications_assessment_session_id_key
  on public.applications (assessment_session_id)
  where assessment_session_id is not null;
create index pilot_participants_invited_user_idx
  on public.pilot_participants (invited_user_id, partner_id);
create index assessment_sessions_owner_partner_updated_idx
  on public.assessment_sessions (owner_user_id, partner_id, updated_at desc);
create index assessment_sessions_partner_status_created_idx
  on public.assessment_sessions (partner_id, status, created_at desc);
create index assessment_results_session_idx
  on public.assessment_results (assessment_session_id);
create index assessment_documents_session_status_idx
  on public.assessment_documents (assessment_session_id, scan_status, created_at);
create index assessment_documents_owner_idx
  on public.assessment_documents (owner_user_id);
create index staff_roles_user_partner_active_idx
  on public.staff_roles (user_id, partner_id, active);
create index assessment_reviews_partner_status_created_idx
  on public.assessment_reviews (partner_id, status, created_at desc, id);
create index assessment_reviews_assigned_status_idx
  on public.assessment_reviews (assigned_to, status);
create index assessment_audit_session_created_idx
  on public.assessment_audit_events (assessment_session_id, created_at desc);
create index assessment_audit_actor_created_idx
  on public.assessment_audit_events (actor_user_id, created_at desc);
create index assessment_rate_limits_expires_idx
  on public.assessment_rate_limits (expires_at);

create trigger set_pilot_participants_updated_at
  before update on public.pilot_participants
  for each row execute function public.set_updated_at();
create trigger set_assessment_sessions_updated_at
  before update on public.assessment_sessions
  for each row execute function public.set_updated_at();
create trigger set_assessment_results_updated_at
  before update on public.assessment_results
  for each row execute function public.set_updated_at();
create trigger set_assessment_documents_updated_at
  before update on public.assessment_documents
  for each row execute function public.set_updated_at();
create trigger set_staff_roles_updated_at
  before update on public.staff_roles
  for each row execute function public.set_updated_at();
create trigger set_assessment_reviews_updated_at
  before update on public.assessment_reviews
  for each row execute function public.set_updated_at();

create or replace function public.is_active_assessment_staff(target_partner_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
    and exists (
      select 1
      from public.staff_roles role
      where role.partner_id = target_partner_id
        and role.user_id = (select auth.uid())
        and role.active
        and (role.expires_at is null or role.expires_at > timezone('utc', now()))
    );
$$;

revoke all on function public.is_active_assessment_staff(text) from public, anon;
grant execute on function public.is_active_assessment_staff(text) to authenticated;

create or replace function public.consume_assessment_rate_limit(
  target_key_hash text,
  target_max integer,
  target_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  window_start timestamptz;
  next_count integer;
begin
  if target_max < 1 or target_window_seconds < 1 then
    raise exception 'invalid rate limit configuration';
  end if;

  window_start := to_timestamp(
    floor(extract(epoch from timezone('utc', now())) / target_window_seconds)
    * target_window_seconds
  );

  insert into public.assessment_rate_limits (
    key_hash, window_started_at, hit_count, expires_at
  ) values (
    target_key_hash,
    window_start,
    1,
    window_start + make_interval(secs => target_window_seconds * 2)
  )
  on conflict (key_hash, window_started_at)
  do update set hit_count = public.assessment_rate_limits.hit_count + 1
  returning hit_count into next_count;

  delete from public.assessment_rate_limits
  where expires_at < timezone('utc', now());

  return next_count <= target_max;
end;
$$;

revoke all on function public.consume_assessment_rate_limit(text, integer, integer)
  from public, anon, authenticated;

alter table public.pilot_participants enable row level security;
alter table public.assessment_sessions enable row level security;
alter table public.assessment_results enable row level security;
alter table public.assessment_documents enable row level security;
alter table public.staff_roles enable row level security;
alter table public.assessment_reviews enable row level security;
alter table public.assessment_audit_events enable row level security;
alter table public.assessment_rate_limits enable row level security;

create policy "Participants read their activated invitation"
  on public.pilot_participants for select to authenticated
  using ((select auth.uid()) = invited_user_id and disabled_at is null);

create policy "Applicants manage their assessment sessions"
  on public.assessment_sessions for all to authenticated
  using ((select auth.uid()) = owner_user_id)
  with check ((select auth.uid()) = owner_user_id);

create policy "Applicants read their assessment results"
  on public.assessment_results for select to authenticated
  using (exists (
    select 1 from public.assessment_sessions session
    where session.id = assessment_results.assessment_session_id
      and session.owner_user_id = (select auth.uid())
  ));

create policy "Applicants read their assessment documents"
  on public.assessment_documents for select to authenticated
  using (owner_user_id = (select auth.uid()));

create policy "AAL2 staff read active roles"
  on public.staff_roles for select to authenticated
  using (
    user_id = (select auth.uid())
    and coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
    and active
  );

create policy "AAL2 staff read partner assessment sessions"
  on public.assessment_sessions for select to authenticated
  using ((select public.is_active_assessment_staff(partner_id)));

create policy "AAL2 staff read partner assessment results"
  on public.assessment_results for select to authenticated
  using ((select public.is_active_assessment_staff(partner_id)));

create policy "AAL2 staff read passed partner documents"
  on public.assessment_documents for select to authenticated
  using (
    scan_status in ('passed', 'promoted')
    and (select public.is_active_assessment_staff(partner_id))
  );

create policy "AAL2 staff manage partner reviews"
  on public.assessment_reviews for all to authenticated
  using ((select public.is_active_assessment_staff(partner_id)))
  with check ((select public.is_active_assessment_staff(partner_id)));

create policy "AAL2 staff read partner audit events"
  on public.assessment_audit_events for select to authenticated
  using ((select public.is_active_assessment_staff(partner_id)));

revoke all on public.pilot_participants from anon;
revoke all on public.assessment_sessions from anon;
revoke all on public.assessment_results from anon;
revoke all on public.assessment_documents from anon;
revoke all on public.staff_roles from anon;
revoke all on public.assessment_reviews from anon;
revoke all on public.assessment_audit_events from anon;
revoke all on public.assessment_rate_limits from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'assessment-quarantine',
  'assessment-quarantine',
  false,
  5242880,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

comment on table public.assessment_results is
  'Server-authoritative indicative UC pilot guidance; null means manual review, never definitive zero credit.';
comment on table public.assessment_audit_events is
  'Append-only API audit trail. Sensitive evidence and reviewer notes must never be copied into metadata.';
