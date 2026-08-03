-- Keep the AAL2 role predicate out of the exposed public API schema, combine
-- applicant/staff read policies, and cover the remaining pilot foreign keys.

create schema if not exists assessment_private;
revoke all on schema assessment_private from public, anon;
grant usage on schema assessment_private to authenticated;

create or replace function assessment_private.is_active_staff(
  target_partner_id text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
    and exists (
      select 1
      from public.staff_roles role
      where role.partner_id = target_partner_id
        and role.user_id = (select auth.uid())
        and role.active
        and (role.expires_at is null or role.expires_at > timezone('utc', now()))
    );
$$;

revoke all on function assessment_private.is_active_staff(text)
  from public, anon;
grant execute on function assessment_private.is_active_staff(text)
  to authenticated;

drop policy if exists "AAL2 staff read active roles" on public.staff_roles;
create policy "AAL2 staff read active roles"
  on public.staff_roles for select to authenticated
  using (
    user_id = (select auth.uid())
    and coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
    and active
  );

drop policy if exists "Applicants read their assessment sessions"
  on public.assessment_sessions;
drop policy if exists "AAL2 staff read partner assessment sessions"
  on public.assessment_sessions;
create policy "Applicants or AAL2 staff read assessment sessions"
  on public.assessment_sessions for select to authenticated
  using (
    owner_user_id = (select auth.uid())
    or (select assessment_private.is_active_staff(partner_id))
  );

drop policy if exists "Applicants read their assessment results"
  on public.assessment_results;
drop policy if exists "AAL2 staff read partner assessment results"
  on public.assessment_results;
create policy "Applicants or AAL2 staff read assessment results"
  on public.assessment_results for select to authenticated
  using (
    exists (
      select 1
      from public.assessment_sessions session
      where session.id = assessment_results.assessment_session_id
        and session.owner_user_id = (select auth.uid())
    )
    or (select assessment_private.is_active_staff(partner_id))
  );

drop policy if exists "Applicants read their assessment documents"
  on public.assessment_documents;
drop policy if exists "AAL2 staff read passed partner documents"
  on public.assessment_documents;
create policy "Applicants or AAL2 staff read assessment documents"
  on public.assessment_documents for select to authenticated
  using (
    owner_user_id = (select auth.uid())
    or (
      scan_status in ('passed', 'promoted')
      and (select assessment_private.is_active_staff(partner_id))
    )
  );

drop policy if exists "AAL2 staff read partner reviews"
  on public.assessment_reviews;
create policy "AAL2 staff read partner reviews"
  on public.assessment_reviews for select to authenticated
  using ((select assessment_private.is_active_staff(partner_id)));

drop policy if exists "AAL2 staff read partner audit events"
  on public.assessment_audit_events;
create policy "AAL2 staff read partner audit events"
  on public.assessment_audit_events for select to authenticated
  using ((select assessment_private.is_active_staff(partner_id)));

drop function public.is_active_assessment_staff(text);

create index assessment_documents_promoted_application_document_idx
  on public.assessment_documents (promoted_application_document_id)
  where promoted_application_document_id is not null;
create index assessment_sessions_application_idx
  on public.assessment_sessions (application_id)
  where application_id is not null;
create index staff_roles_invited_by_idx
  on public.staff_roles (invited_by)
  where invited_by is not null;

comment on function assessment_private.is_active_staff(text) is
  'AAL2 and active partner-role predicate for RLS only; schema is not exposed through the data API.';
