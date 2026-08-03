-- Assessment state changes are API-only so trusted outcomes, staff transitions,
-- and audit writes cannot be bypassed through the Supabase data API.

drop policy if exists "Applicants manage their assessment sessions"
  on public.assessment_sessions;
create policy "Applicants read their assessment sessions"
  on public.assessment_sessions for select to authenticated
  using ((select auth.uid()) = owner_user_id);

drop policy if exists "AAL2 staff manage partner reviews"
  on public.assessment_reviews;
create policy "AAL2 staff read partner reviews"
  on public.assessment_reviews for select to authenticated
  using ((select public.is_active_assessment_staff(partner_id)));

revoke insert, update, delete on public.pilot_participants from authenticated;
revoke insert, update, delete on public.assessment_sessions from authenticated;
revoke insert, update, delete on public.assessment_results from authenticated;
revoke insert, update, delete on public.assessment_documents from authenticated;
revoke insert, update, delete on public.staff_roles from authenticated;
revoke insert, update, delete on public.assessment_reviews from authenticated;
revoke insert, update, delete on public.assessment_audit_events from authenticated;

create or replace function public.protect_application_assessment_context()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.role()) = 'authenticated' then
    if tg_op = 'INSERT' and (
      new.partner_id is not null
      or new.catalogue_id is not null
      or new.catalogue_version is not null
      or new.assessment_rules_version is not null
      or new.assessment_model_version is not null
      or new.assessment_session_id is not null
    ) then
      raise exception 'assessment context is server-managed';
    end if;

    if tg_op = 'UPDATE' and (
      new.partner_id is distinct from old.partner_id
      or new.catalogue_id is distinct from old.catalogue_id
      or new.catalogue_version is distinct from old.catalogue_version
      or new.assessment_rules_version is distinct from old.assessment_rules_version
      or new.assessment_model_version is distinct from old.assessment_model_version
      or new.assessment_session_id is distinct from old.assessment_session_id
    ) then
      raise exception 'assessment context is server-managed';
    end if;
  end if;

  return new;
end;
$$;

create trigger protect_application_assessment_context
  before insert or update on public.applications
  for each row execute function public.protect_application_assessment_context();

comment on function public.protect_application_assessment_context() is
  'Prevents authenticated clients from forging partner or assessment provenance; service-role assessment APIs remain authoritative.';
