do $$
begin
  if exists (
    select 1
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'handle_new_auth_user'
      and pg_get_function_identity_arguments(oid) = ''
  ) then
    execute 'revoke all on function public.handle_new_auth_user() from public';
    execute 'revoke all on function public.handle_new_auth_user() from anon';
    execute 'revoke all on function public.handle_new_auth_user() from authenticated';
  end if;

  if exists (
    select 1
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'upsert_applicant_profile'
      and pg_get_function_identity_arguments(oid) = 'p_first_name text, p_last_name text, p_phone text'
  ) then
    execute 'revoke all on function public.upsert_applicant_profile(text, text, text) from public';
    execute 'revoke all on function public.upsert_applicant_profile(text, text, text) from anon';
    execute 'revoke all on function public.upsert_applicant_profile(text, text, text) from authenticated';
  end if;
end
$$;
