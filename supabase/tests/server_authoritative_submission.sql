begin;

create extension if not exists pgtap with schema extensions;

select plan(23);

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
  '11111111-1111-4111-8111-111111111111',
  'authenticated',
  'authenticated',
  'submission-boundary@example.test',
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
  '11111111-1111-4111-8111-111111111111',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","email":"submission-boundary@example.test"}',
  true
);

select lives_ok(
  $insert_application$
    insert into public.applications (
      id,
      user_id,
      catalog_id,
      course_code,
      course_title,
      intake_label,
      personal_details,
      contact_details,
      requires_english_proficiency,
      english_proficiency_policy,
      section2_submission_policy
    )
    values (
      '22222222-2222-4222-8222-222222222222',
      '11111111-1111-4111-8111-111111111111',
      'default',
      'university-of-southern-queensland-unisq-master-of-business-administration-mba',
      'Caller-controlled title',
      'January',
      '{
        "title":"Mx",
        "firstName":"Pat",
        "lastName":"Applicant",
        "gender":"Non-binary",
        "dateOfBirth":"1990-01-01",
        "email":"submission-boundary@example.test",
        "phone":"0400000000"
      }'::jsonb,
      '{
        "citizenshipStatus":"Australian citizen",
        "residentialAddress":{"formattedAddress":"1 Test Street"},
        "language":"English",
        "aboriginal":"No",
        "schoolLevel":"Bachelor degree",
        "parentsCount":"0"
      }'::jsonb,
      false,
      '[]'::jsonb,
      '{"minimumEducationRank":0,"supportsExperienceAlternative":true}'::jsonb
    )
  $insert_application$,
  'an applicant can create an owned draft'
);

select is(
  (
    select requires_english_proficiency
    from public.applications
    where id = '22222222-2222-4222-8222-222222222222'
  ),
  true,
  'the database overrides caller-controlled English policy'
);

select is(
  (
    select section2_submission_policy ->> 'minimumEducationRank'
    from public.applications
    where id = '22222222-2222-4222-8222-222222222222'
  ),
  '3',
  'the database overrides caller-controlled Section 2 policy'
);

select is(
  (
    select course_title
    from public.applications
    where id = '22222222-2222-4222-8222-222222222222'
  ),
  'Master of Business Administration (MBA)',
  'the database applies the trusted course title'
);

select throws_ok(
  $direct_status_update$
    update public.applications
    set status = 'submitted'
    where id = '22222222-2222-4222-8222-222222222222'
  $direct_status_update$,
  '42501',
  'new row violates row-level security policy for table "applications"',
  'an applicant cannot set submitted status directly'
);

select throws_ok(
  $generate_number$select public.generate_application_number()$generate_number$,
  '42501',
  'permission denied for function generate_application_number',
  'an applicant cannot call the number generator directly'
);

select lives_ok(
  $insert_object$
    insert into storage.objects (id, bucket_id, name, owner, metadata)
    values (
      '44444444-4444-4444-8444-444444444444',
      'application-documents',
      '11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/tertiary_transcript/33333333-3333-4333-8333-333333333333/transcript.pdf',
      '11111111-1111-4111-8111-111111111111',
      '{"size":1024}'::jsonb
    )
  $insert_object$,
  'an applicant can upload an object for an owned draft'
);

select lives_ok(
  $insert_document$
    insert into public.application_documents (
      id,
      application_id,
      kind,
      storage_bucket,
      storage_path,
      file_name,
      mime_type,
      size_bytes
    )
    values (
      '33333333-3333-4333-8333-333333333333',
      '22222222-2222-4222-8222-222222222222',
      'tertiary_transcript',
      'application-documents',
      '11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/tertiary_transcript/33333333-3333-4333-8333-333333333333/transcript.pdf',
      'transcript.pdf',
      'application/pdf',
      1024
    )
  $insert_document$,
  'an applicant can add document metadata to an owned draft'
);

select lives_ok(
  $insert_qualification$
    insert into public.tertiary_qualifications (
      id,
      application_id,
      institution,
      country,
      level,
      course_name,
      start_month,
      start_year,
      completed,
      end_month,
      end_year,
      transcript_document_id
    )
    values (
      '55555555-5555-4555-8555-555555555555',
      '22222222-2222-4222-8222-222222222222',
      'Example University',
      'Australia',
      'Bachelor',
      'Bachelor of Testing',
      'January',
      '2018',
      false,
      'December',
      '2021',
      '33333333-3333-4333-8333-333333333333'
    )
  $insert_qualification$,
  'an applicant can add evidence to an owned draft'
);

select lives_ok(
  $submit$select public.submit_application(
    '22222222-2222-4222-8222-222222222222'
  )$submit$,
  'the authoritative RPC can submit a valid application'
);

select ok(
  (
    select
      status = 'submitted'
      and application_number is not null
      and submitted_at is not null
    from public.applications
    where id = '22222222-2222-4222-8222-222222222222'
  ),
  'the RPC assigns all server-owned submission fields'
);

select is(
  public.submit_application('22222222-2222-4222-8222-222222222222')
    ->> 'applicationNumber',
  (
    select application_number
    from public.applications
    where id = '22222222-2222-4222-8222-222222222222'
  ),
  'repeated submit is idempotent'
);

select results_eq(
  $submitted_application_update$
    with changed as (
      update public.applications
      set course_title = 'Tampered after submit'
      where id = '22222222-2222-4222-8222-222222222222'
      returning 1
    )
    select count(*) from changed
  $submitted_application_update$,
  $expected$values (0::bigint)$expected$,
  'a submitted application is immutable to its applicant'
);

select results_eq(
  $submitted_child_update$
    with changed as (
      update public.tertiary_qualifications
      set course_name = 'Tampered after submit'
      where id = '55555555-5555-4555-8555-555555555555'
      returning 1
    )
    select count(*) from changed
  $submitted_child_update$,
  $expected$values (0::bigint)$expected$,
  'submitted child evidence cannot be updated'
);

select results_eq(
  $submitted_document_delete$
    with removed as (
      delete from public.application_documents
      where id = '33333333-3333-4333-8333-333333333333'
      returning 1
    )
    select count(*) from removed
  $submitted_document_delete$,
  $expected$values (0::bigint)$expected$,
  'submitted document metadata cannot be deleted'
);

select set_config('storage.allow_delete_query', 'true', true);

select results_eq(
  $submitted_object_delete$
    with removed as (
      delete from storage.objects
      where id = '44444444-4444-4444-8444-444444444444'
      returning 1
    )
    select count(*) from removed
  $submitted_object_delete$,
  $expected$values (0::bigint)$expected$,
  'submitted stored evidence cannot be deleted'
);

select ok(
  exists (
    select 1 from public.applications
    where id = '22222222-2222-4222-8222-222222222222'
  )
  and exists (
    select 1 from public.tertiary_qualifications
    where id = '55555555-5555-4555-8555-555555555555'
  )
  and exists (
    select 1 from public.application_documents
    where id = '33333333-3333-4333-8333-333333333333'
  )
  and exists (
    select 1 from storage.objects
    where id = '44444444-4444-4444-8444-444444444444'
  ),
  'submitted applications and evidence remain readable to their applicant'
);

select lives_ok(
  $insert_deletable_draft$
    insert into public.applications (
      id,
      user_id,
      catalog_id,
      course_code,
      course_title,
      intake_label
    )
    values (
      '66666666-6666-4666-8666-666666666666',
      '11111111-1111-4111-8111-111111111111',
      'default',
      'master-of-business-administration',
      'Caller title',
      'January'
    )
  $insert_deletable_draft$,
  'another owned draft can still be created'
);

select lives_ok(
  $insert_deletable_child$
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
      '66666666-6666-4666-8666-666666666666',
      'Example Company',
      'Tester',
      'Full-time',
      'January',
      '2020',
      'Testing'
    )
  $insert_deletable_child$,
  'child data can still be added to an owned draft'
);

select results_eq(
  $draft_delete$
    with removed as (
      delete from public.applications
      where id = '66666666-6666-4666-8666-666666666666'
      returning 1
    )
    select count(*) from removed
  $draft_delete$,
  $expected$values (1::bigint)$expected$,
  'an owned draft can still be deleted'
);

select results_eq(
  $submitted_application_delete$
    with removed as (
      delete from public.applications
      where id = '22222222-2222-4222-8222-222222222222'
      returning 1
    )
    select count(*) from removed
  $submitted_application_delete$,
  $expected$values (0::bigint)$expected$,
  'a submitted application cannot be deleted by its applicant'
);

select throws_ok(
  $unknown_course$
    insert into public.applications (
      id,
      user_id,
      catalog_id,
      course_code,
      course_title,
      intake_label
    )
    values (
      '77777777-7777-4777-8777-777777777777',
      '11111111-1111-4111-8111-111111111111',
      'default',
      'not-a-real-course',
      'Unknown',
      'January'
    )
  $unknown_course$,
  '23514',
  'APPLICATION_COURSE_POLICY_NOT_FOUND',
  'an unknown course cannot bypass the trusted policy snapshot'
);

select throws_ok(
  $read_policy_table$select count(*) from public.course_submission_policies$read_policy_table$,
  '42501',
  'permission denied for table course_submission_policies',
  'the applicant cannot query the internal policy table directly'
);

reset role;
select * from finish();
rollback;
