-- Migration: Course-specific Section 2 submission policy
--
-- Persists a compact course-derived Section 2 policy on the application row so
-- submit_application can enforce the same education/experience paths as the
-- client-side course-specific validation.

alter table public.applications
  add column if not exists section2_submission_policy jsonb;

comment on column public.applications.section2_submission_policy is
  'Course-derived Section 2 submit policy snapshot used by application_submission_missing_fields.';

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
  qualifying_tertiary_count integer := 0;
  secondary_count integer := 0;
  employment_count integer := 0;
  cv_uploaded boolean := false;
  section2_policy jsonb;
  section2_minimum_rank integer := 0;
  section2_supports_secondary boolean := false;
  section2_supports_experience boolean := false;
  section2_evidence_label text := 'a qualifying education history';
  english_medium_count integer := 0;
  language_test_count integer := 0;
  ahpra_count integer := 0;
  english_policy jsonb := '[]'::jsonb;
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
  into secondary_count
  from public.secondary_qualifications
  where application_id = target_application_id;

  select count(*)
  into employment_count
  from public.employment_experiences
  where application_id = target_application_id;

  cv_uploaded := public.application_document_is_ready(
    application_row.cv_document_id,
    target_application_id
  );

  section2_policy := application_row.section2_submission_policy;

  if section2_policy is null then
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
  else
    section2_minimum_rank := coalesce(
      nullif(section2_policy ->> 'minimumEducationRank', '')::integer,
      0
    );
    section2_supports_secondary := coalesce(
      (section2_policy ->> 'supportsSecondaryQualification')::boolean,
      false
    );
    section2_supports_experience := coalesce(
      (section2_policy ->> 'supportsExperienceAlternative')::boolean,
      false
    );
    section2_evidence_label := coalesce(
      nullif(section2_policy ->> 'educationEvidenceLabel', ''),
      section2_evidence_label
    );

    select count(*)
    into qualifying_tertiary_count
    from public.tertiary_qualifications
    where application_id = target_application_id
      and (
        section2_minimum_rank <= 1
        or case lower(trim(level))
          when 'associate degree' then 2
          when 'advanced diploma' then 2
          when 'diploma' then 2
          when 'bachelor' then 3
          when 'bachelor degree' then 3
          when 'graduate certificate' then 4
          when 'graduate diploma' then 4
          when 'honours' then 4
          when 'masters' then 5
          when 'masters degree' then 5
          when 'master degree' then 5
          when 'phd' then 6
          when 'doctorate' then 6
          else 0
        end >= section2_minimum_rank
      );

    if qualifying_tertiary_count = 0
      and not (section2_supports_secondary and secondary_count > 0)
      and not (section2_supports_experience and cv_uploaded and employment_count > 0) then
      missing_fields := array_append(
        missing_fields,
        case
          when section2_supports_experience then
            format(
              'Add either %s or both a CV and employment experience',
              section2_evidence_label
            )
          else
            format('Add %s', section2_evidence_label)
        end
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

  if application_row.requires_english_proficiency then
    english_policy := coalesce(application_row.english_proficiency_policy, '[]'::jsonb);

    select count(*)
    into english_medium_count
    from public.tertiary_qualifications
    where application_id = target_application_id
      and lower(trim(country)) = any (english_medium_countries);

    select count(*)
    into language_test_count
    from public.language_tests test
    where test.application_id = target_application_id
      and public.application_document_is_ready(test.document_id, target_application_id)
      and (
        jsonb_array_length(english_policy) = 0
        or exists (
          select 1
          from jsonb_array_elements(english_policy) requirement,
            jsonb_array_elements(coalesce(requirement #> '{params,acceptedPathways}', '[]'::jsonb)) pathway
          where pathway ->> 'type' = 'english_test'
            and case pathway ->> 'test'
              when 'IELTS' then lower(test.test_type) = 'ielts'
              when 'TOEFL_iBT' then lower(test.test_type) in ('toefl', 'toefl ibt', 'toefl_ibt')
              when 'PTE' then lower(test.test_type) in ('pte', 'pte academic')
              when 'CAE' then lower(test.test_type) in ('cambridge', 'cambridge english', 'cae')
              when 'OET' then lower(test.test_type) = 'oet' or lower(test.test_name) like '%oet%'
              else false
            end
            and test.overall_score >= (pathway ->> 'minOverall')::numeric
            and (
              pathway ->> 'minBand' is null
              or (
                test.listening_score >= (pathway ->> 'minBand')::numeric
                and test.reading_score >= (pathway ->> 'minBand')::numeric
                and test.writing_score >= (pathway ->> 'minBand')::numeric
                and test.speaking_score >= (pathway ->> 'minBand')::numeric
              )
            )
        )
      );

    select count(*)
    into ahpra_count
    from public.professional_accreditations accreditation
    where accreditation.application_id = target_application_id
      and lower(trim(accreditation.status)) = 'active'
      and public.application_document_is_ready(accreditation.document_id, target_application_id)
      and accreditation.name ~* '\yahpra\y|australian health practitioner|nursing and midwifery board|medical board of australia|dental board of australia|registered\s+(nurse|midwife|midwifery|medical practitioner|pharmacist|physiotherapist|psychologist|dentist|optometrist|paramedic|occupational therapist|chiropractor|osteopath|podiatrist|radiographer)';

    if english_medium_count = 0
      and language_test_count = 0
      and ahpra_count = 0 then
      missing_fields := array_append(
        missing_fields,
        'Proof of English proficiency (approved English test scores or current AHPRA registration)'
      );
    end if;
  end if;

  return missing_fields;
end;
$$;
