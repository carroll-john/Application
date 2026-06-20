-- Migration: Conditional ("optional hard") submission requirements
--
-- Two submission requirements become conditional instead of unconditional. The
-- client (src/lib/eligibility/englishProficiencyEvidence.ts) already surfaces and
-- blocks on these; this migration teaches the server-side submit RPC the same rules
-- so submission can never bypass them.
--
--   1. Certificate of Completion — required only when a qualification is marked
--      completed AND its transcript can't evidence that completion. The transcript
--      signal is computed client-side (from the parsed transcript) and persisted on
--      tertiary_qualifications.transcript_confirms_completion.
--   2. English proficiency — required only when the selected course requires it AND
--      it can't be inferred from a transcript (study at an English-medium-country
--      institution) AND no English test or AHPRA registration has been provided.
--      Whether the course requires it is persisted on
--      applications.requires_english_proficiency.
--
-- The function below is rebuilt from the current definition in
-- 20260522120000_storage_quota_and_document_integrity.sql (security-invoker, no
-- is_allowed_company_user guard — that function was dropped in
-- 20260520054255_applicant_email_otp_auth.sql — and document checks via
-- public.application_document_is_ready). Only the two conditional rules are added.
-- search_path is set inline because CREATE OR REPLACE resets configuration params.

-- New persisted signals -------------------------------------------------------

alter table public.tertiary_qualifications
  add column if not exists transcript_confirms_completion boolean not null default false;

alter table public.applications
  add column if not exists requires_english_proficiency boolean not null default false;

-- Updated submission validation ----------------------------------------------

create or replace function public.application_submission_missing_fields(
  target_application_id uuid
)
returns text[]
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  application_row public.applications%rowtype;
  missing_fields text[] := array[]::text[];
  parent_count integer := 0;
  parent_index integer;
  tertiary_row record;
  tertiary_count integer := 0;
  employment_count integer := 0;
  cv_uploaded boolean := false;
  english_medium_count integer := 0;
  language_test_count integer := 0;
  ahpra_count integer := 0;
  -- Lower-cased free-text spellings that resolve to an English-medium country.
  -- Mirrors DEFAULT_ENGLISH_MEDIUM_COUNTRIES + COUNTRY_ALIAS_TO_CODE in
  -- src/lib/eligibility/englishMediumCountries.ts (Singapore is intentionally
  -- excluded — it is not in the default accepted list).
  english_medium_countries text[] := array[
    'au', 'aus', 'australia',
    'nz', 'new zealand',
    'uk', 'gb', 'gbr', 'britain', 'united kingdom', 'great britain',
    'england', 'scotland', 'wales', 'northern ireland',
    'ie', 'ireland', 'republic of ireland',
    'us', 'usa', 'united states', 'united states of america', 'america',
    'ca', 'canada',
    'za', 'south africa'
  ];
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to submit an application.';
  end if;

  select *
  into application_row
  from public.applications
  where id = target_application_id
    and user_id = auth.uid();

  if not found then
    raise exception 'Application not found.';
  end if;

  if coalesce(trim(application_row.personal_details ->> 'title'), '') = '' then
    missing_fields := array_append(missing_fields, 'Title');
  end if;
  if coalesce(trim(application_row.personal_details ->> 'firstName'), '') = '' then
    missing_fields := array_append(missing_fields, 'First name');
  end if;
  if coalesce(trim(application_row.personal_details ->> 'lastName'), '') = '' then
    missing_fields := array_append(missing_fields, 'Last name');
  end if;
  if coalesce(trim(application_row.personal_details ->> 'gender'), '') = '' then
    missing_fields := array_append(missing_fields, 'Gender');
  end if;
  if coalesce(trim(application_row.personal_details ->> 'dateOfBirth'), '') = '' then
    missing_fields := array_append(missing_fields, 'Date of birth');
  end if;
  if coalesce(trim(application_row.personal_details ->> 'email'), '') = '' then
    missing_fields := array_append(missing_fields, 'Email address');
  end if;
  if coalesce(trim(application_row.personal_details ->> 'phone'), '') = '' then
    missing_fields := array_append(missing_fields, 'Phone number');
  end if;

  if coalesce(trim(application_row.contact_details ->> 'citizenshipStatus'), '') = '' then
    missing_fields := array_append(missing_fields, 'Citizenship status');
  end if;
  if coalesce(
    trim(application_row.contact_details #>> '{residentialAddress,formattedAddress}'),
    ''
  ) = '' then
    missing_fields := array_append(missing_fields, 'Permanent residential address');
  end if;
  if coalesce(trim(application_row.contact_details ->> 'language'), '') = '' then
    missing_fields := array_append(missing_fields, 'Language spoken');
  end if;
  if coalesce(trim(application_row.contact_details ->> 'aboriginal'), '') = '' then
    missing_fields := array_append(
      missing_fields,
      'Aboriginal or Torres Strait Islander status'
    );
  end if;
  if coalesce(trim(application_row.contact_details ->> 'schoolLevel'), '') = '' then
    missing_fields := array_append(missing_fields, 'School level');
  end if;

  begin
    parent_count := coalesce(nullif(application_row.contact_details ->> 'parentsCount', '')::integer, 0);
  exception
    when others then
      parent_count := 0;
  end;

  for parent_index in 1..least(parent_count, 5) loop
    if coalesce(
      trim(application_row.contact_details ->> format('parent%sDetails', parent_index)),
      ''
    ) = '' then
      missing_fields := array_append(
        missing_fields,
        format('Parent/Guardian %s Education Level', parent_index)
      );
    end if;
  end loop;

  select count(*)
  into tertiary_count
  from public.tertiary_qualifications
  where application_id = target_application_id;

  select count(*)
  into employment_count
  from public.employment_experiences
  where application_id = target_application_id;

  cv_uploaded := public.application_document_is_ready(
    application_row.cv_document_id,
    target_application_id
  );

  if tertiary_count = 0 and not (cv_uploaded and employment_count > 0) then
    if not cv_uploaded then
      missing_fields := array_append(
        missing_fields,
        'CV upload or a tertiary qualification'
      );
    end if;
    if employment_count = 0 then
      missing_fields := array_append(
        missing_fields,
        'Employment experience or a tertiary qualification'
      );
    end if;
  end if;

  for tertiary_row in
    select
      course_name,
      completed,
      transcript_confirms_completion,
      transcript_document_id,
      certificate_document_id
    from public.tertiary_qualifications
    where application_id = target_application_id
    order by created_at asc
  loop
    if not public.application_document_is_ready(
      tertiary_row.transcript_document_id,
      target_application_id
    ) then
      missing_fields := array_append(
        missing_fields,
        format('Qualification "%s": Academic Transcript', tertiary_row.course_name)
      );
    end if;

    -- Optional hard requirement: only when completed but the transcript can't
    -- evidence completion (and no certificate document is ready).
    if tertiary_row.completed
      and not coalesce(tertiary_row.transcript_confirms_completion, false)
      and not public.application_document_is_ready(
        tertiary_row.certificate_document_id,
        target_application_id
      ) then
      missing_fields := array_append(
        missing_fields,
        format('Qualification "%s": Certificate of Completion', tertiary_row.course_name)
      );
    end if;
  end loop;

  -- Optional hard requirement: English proficiency. Only when the course requires
  -- it, it can't be inferred from an English-medium-country qualification, and no
  -- English test or AHPRA registration evidences it. The AHPRA pattern mirrors
  -- AHPRA_REGISTRATION_PATTERN in src/lib/eligibility/englishProficiencyEvidence.ts.
  if application_row.requires_english_proficiency then
    select count(*)
    into english_medium_count
    from public.tertiary_qualifications
    where application_id = target_application_id
      and lower(trim(country)) = any (english_medium_countries);

    select count(*)
    into language_test_count
    from public.language_tests
    where application_id = target_application_id;

    select count(*)
    into ahpra_count
    from public.professional_accreditations
    where application_id = target_application_id
      and name ~* '\yahpra\y|australian health practitioner|nursing and midwifery board|medical board of australia|dental board of australia|registered\s+(nurse|midwife|midwifery|medical practitioner|pharmacist|physiotherapist|psychologist|dentist|optometrist|paramedic|occupational therapist|chiropractor|osteopath|podiatrist|radiographer)';

    if english_medium_count = 0
      and language_test_count = 0
      and ahpra_count = 0 then
      missing_fields := array_append(
        missing_fields,
        'Proof of English proficiency (an English test or AHPRA registration)'
      );
    end if;
  end if;

  return missing_fields;
end;
$$;
