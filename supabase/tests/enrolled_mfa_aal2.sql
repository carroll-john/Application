begin;

create extension if not exists pgtap with schema extensions;

select plan(16);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
)
values (
  '00000000-0000-0000-0000-000000000000',
  '81111111-1111-4111-8111-111111111111',
  'authenticated',
  'authenticated',
  'mfa-boundary@example.test',
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now(),
  '',
  '',
  '',
  ''
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '81111111-1111-4111-8111-111111111111',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"81111111-1111-4111-8111-111111111111","role":"authenticated","email":"mfa-boundary@example.test","aal":"aal1"}',
  true
);

select lives_ok(
  $no_factor_insert$
    insert into public.applications (
      id,
      user_id,
      catalog_id,
      course_code,
      course_title,
      intake_label
    )
    values (
      '82222222-2222-4222-8222-222222222222',
      '81111111-1111-4111-8111-111111111111',
      'default',
      'master-of-business-administration',
      'Caller title',
      'January'
    )
  $no_factor_insert$,
  'AAL1 applicants without an enrolled factor retain normal draft access'
);

select lives_ok(
  $no_factor_object_insert$
    insert into storage.objects (id, bucket_id, name, owner, metadata)
    values (
      '83333333-3333-4333-8333-333333333333',
      'application-documents',
      '81111111-1111-4111-8111-111111111111/82222222-2222-4222-8222-222222222222/cv/84444444-4444-4444-8444-444444444444/cv.pdf',
      '81111111-1111-4111-8111-111111111111',
      '{"size":1024}'::jsonb
    )
  $no_factor_object_insert$,
  'AAL1 applicants without an enrolled factor retain document access'
);

reset role;

insert into auth.mfa_factors (
  id,
  user_id,
  factor_type,
  status,
  created_at,
  updated_at,
  secret
)
values (
  '85555555-5555-4555-8555-555555555555',
  '81111111-1111-4111-8111-111111111111',
  'totp',
  'verified',
  now(),
  now(),
  'test-secret'
);

set local role authenticated;

select results_eq(
  $aal1_application_read$
    select count(*)
    from public.applications
    where id = '82222222-2222-4222-8222-222222222222'
  $aal1_application_read$,
  $expected$values (0::bigint)$expected$,
  'AAL1 cannot read applicant data after a factor is enrolled'
);

select results_eq(
  $aal1_application_update$
    with changed as (
      update public.applications
      set intake_label = 'July'
      where id = '82222222-2222-4222-8222-222222222222'
      returning 1
    )
    select count(*) from changed
  $aal1_application_update$,
  $expected$values (0::bigint)$expected$,
  'AAL1 cannot update applicant data after a factor is enrolled'
);

select results_eq(
  $aal1_object_read$
    select count(*)
    from storage.objects
    where id = '83333333-3333-4333-8333-333333333333'
  $aal1_object_read$,
  $expected$values (0::bigint)$expected$,
  'AAL1 cannot read applicant document objects after a factor is enrolled'
);

select throws_ok(
  $aal1_application_insert$
    insert into public.applications (
      id,
      user_id,
      catalog_id,
      course_code,
      course_title,
      intake_label
    )
    values (
      '86666666-6666-4666-8666-666666666666',
      '81111111-1111-4111-8111-111111111111',
      'default',
      'master-of-business-administration',
      'Caller title',
      'January'
    )
  $aal1_application_insert$,
  '42501',
  'new row violates row-level security policy "Applicants with enrolled MFA require AAL2" for table "applications"',
  'AAL1 cannot create applicant data after a factor is enrolled'
);

select throws_ok(
  $aal1_submit$
    select public.submit_application(
      '82222222-2222-4222-8222-222222222222'
    )
  $aal1_submit$,
  '42501',
  'MFA_CHALLENGE_REQUIRED',
  'the SECURITY DEFINER submission RPC independently requires AAL2'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"81111111-1111-4111-8111-111111111111","role":"authenticated","email":"mfa-boundary@example.test","aal":"aal2"}',
  true
);

select results_eq(
  $aal2_application_read$
    select count(*)
    from public.applications
    where id = '82222222-2222-4222-8222-222222222222'
  $aal2_application_read$,
  $expected$values (1::bigint)$expected$,
  'AAL2 restores applicant data reads'
);

select results_eq(
  $aal2_application_update$
    with changed as (
      update public.applications
      set intake_label = 'July'
      where id = '82222222-2222-4222-8222-222222222222'
      returning 1
    )
    select count(*) from changed
  $aal2_application_update$,
  $expected$values (1::bigint)$expected$,
  'AAL2 restores applicant data writes'
);

select results_eq(
  $aal2_object_read$
    select count(*)
    from storage.objects
    where id = '83333333-3333-4333-8333-333333333333'
  $aal2_object_read$,
  $expected$values (1::bigint)$expected$,
  'AAL2 restores applicant document access'
);

select lives_ok(
  $aal2_child_insert$
    insert into public.employment_experiences (
      application_id,
      company,
      position,
      employment_type,
      start_month,
      start_year,
      duties
    )
    values (
      '82222222-2222-4222-8222-222222222222',
      'Example Company',
      'Tester',
      'Full-time',
      'January',
      '2020',
      'Testing'
    )
  $aal2_child_insert$,
  'AAL2 restores child-evidence writes'
);

select throws_like(
  $aal2_submit$
    select public.submit_application(
      '82222222-2222-4222-8222-222222222222'
    )
  $aal2_submit$,
  'Application submission failed:%',
  'AAL2 passes the MFA gate and reaches ordinary submission validation'
);

reset role;
update auth.mfa_factors
set status = 'unverified', updated_at = now()
where id = '85555555-5555-4555-8555-555555555555';
set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"81111111-1111-4111-8111-111111111111","role":"authenticated","email":"mfa-boundary@example.test","aal":"aal1"}',
  true
);

select results_eq(
  $factor_removed_read$
    select count(*)
    from public.applications
    where id = '82222222-2222-4222-8222-222222222222'
  $factor_removed_read$,
  $expected$values (1::bigint)$expected$,
  'AAL1 access returns when no verified factor remains'
);

select throws_like(
  $factor_removed_submit$
    select public.submit_application(
      '82222222-2222-4222-8222-222222222222'
    )
  $factor_removed_submit$,
  'Application submission failed:%',
  'submission no longer requires AAL2 after the verified factor is removed'
);

reset role;

select is(
  (
    select count(*)::integer
    from pg_policies
    where policyname = 'Applicants with enrolled MFA require AAL2'
  ),
  10,
  'the MFA policy covers all nine applicant tables and document storage'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where policyname = 'Applicants with enrolled MFA require AAL2'
      and permissive = 'RESTRICTIVE'
  ),
  10,
  'every MFA policy is restrictive rather than permissive'
);

select * from finish();
rollback;
