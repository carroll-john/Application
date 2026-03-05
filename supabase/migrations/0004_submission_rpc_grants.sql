do $$
begin
  if exists (
    select 1
    from pg_class sequence_object
    where sequence_object.relkind = 'S'
      and sequence_object.relname = 'application_number_seq'
      and sequence_object.relnamespace = 'public'::regnamespace
  ) then
    grant usage, select, update
      on sequence public.application_number_seq
      to authenticated;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from pg_proc function_object
    where function_object.pronamespace = 'public'::regnamespace
      and function_object.proname = 'generate_application_number'
      and pg_get_function_identity_arguments(function_object.oid) = ''
  ) then
    grant execute on function public.generate_application_number() to authenticated;
  end if;

  if exists (
    select 1
    from pg_proc function_object
    where function_object.pronamespace = 'public'::regnamespace
      and function_object.proname = 'application_submission_missing_fields'
      and pg_get_function_identity_arguments(function_object.oid) = 'target_application_id uuid'
  ) then
    grant execute
      on function public.application_submission_missing_fields(uuid)
      to authenticated;
  end if;

  if exists (
    select 1
    from pg_proc function_object
    where function_object.pronamespace = 'public'::regnamespace
      and function_object.proname = 'submit_application'
      and pg_get_function_identity_arguments(function_object.oid) = 'target_application_id uuid'
  ) then
    grant execute on function public.submit_application(uuid) to authenticated;
  end if;
end
$$;
