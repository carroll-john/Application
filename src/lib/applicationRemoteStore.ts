import type { Session } from "@supabase/supabase-js";
import {
  APPLICATION_COURSE,
  hasStartedApplication,
} from "./applicationProgress";
import {
  initialApplicationData,
  mergeStoredApplicationData,
  type ApplicationData,
  type ContactDetails,
  type EmploymentExperience,
  type LanguageTest,
  type PersonalDetails,
  type ProfessionalAccreditation,
  type SecondaryQualification,
  type TertiaryQualification,
} from "./applicationData";
import { deriveApplicantProfileSeed } from "./applicantProfiles";
import type { UploadedDocument } from "./documentStorage";
import { supabase } from "./supabase";

interface RemoteApplicationRow {
  id: string;
  applicant_profile_id: string | null;
  application_number: string | null;
  submitted_at: string | null;
  course_code: string | null;
  course_title: string | null;
  intake_label: string | null;
  personal_details: PersonalDetails | null;
  contact_details: ContactDetails | null;
  cv_document_id: string | null;
  cv_file_name: string | null;
}

interface RemoteApplicationDocumentRow {
  id: string;
  file_name: string;
  size_bytes: number;
  mime_type: string;
  created_at: string;
  storage_bucket: string;
  storage_path: string;
}

interface RemoteTertiaryQualificationRow {
  id: string;
  institution: string;
  country: string;
  level: string;
  course_name: string;
  start_month: string;
  start_year: string;
  completed: boolean;
  end_month: string;
  end_year: string;
  transcript_document_id: string | null;
  transcript_document_name: string | null;
  certificate_document_id: string | null;
  certificate_document_name: string | null;
}

interface RemoteEmploymentExperienceRow {
  id: string;
  company: string;
  position: string;
  employment_type: string;
  start_month: string;
  start_year: string;
  end_month: string | null;
  end_year: string | null;
  is_current_role: boolean;
  duties: string;
}

interface RemoteProfessionalAccreditationRow {
  id: string;
  name: string;
  status: string;
  document_id: string | null;
  document_name: string | null;
}

interface RemoteSecondaryQualificationRow {
  id: string;
  qualification_type: string;
  country: string;
  state: string;
  school: string;
  qualification_name: string;
  completion_year: string;
}

interface RemoteLanguageTestRow {
  id: string;
  test_type: string;
  test_name: string;
  completion_year: string;
  document_id: string | null;
  document_name: string | null;
}

interface RemoteSubmissionResult {
  applicationId: string;
  applicationNumber: string;
  submittedAt: string;
}

export interface RemoteSaveResult {
  applicationId: string;
  applicantProfileId: string | null;
}

function requireSupabaseClient() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  return supabase;
}

export async function loadRemoteApplication(
  session: Session,
): Promise<ApplicationData | null> {
  const client = requireSupabaseClient();

  const { data: applications, error } = await client
    .from("applications")
    .select(
      "id, applicant_profile_id, application_number, submitted_at, course_code, course_title, intake_label, personal_details, contact_details, cv_document_id, cv_file_name",
    )
    .eq("user_id", session.user.id)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  const application = applications?.[0] as RemoteApplicationRow | undefined;

  if (!application) {
    return null;
  }

  const applicationId = application.id;

  const [
    applicationDocumentsResponse,
    tertiaryQualificationsResponse,
    employmentExperiencesResponse,
    professionalAccreditationsResponse,
    secondaryQualificationsResponse,
    languageTestsResponse,
  ] = await Promise.all([
    client
      .from("application_documents")
      .select(
        "id, file_name, size_bytes, mime_type, created_at, storage_bucket, storage_path",
      )
      .eq("application_id", applicationId),
    client
      .from("tertiary_qualifications")
      .select(
        "id, institution, country, level, course_name, start_month, start_year, completed, end_month, end_year, transcript_document_id, transcript_document_name, certificate_document_id, certificate_document_name",
      )
      .eq("application_id", applicationId)
      .order("created_at", { ascending: true }),
    client
      .from("employment_experiences")
      .select(
        "id, company, position, employment_type, start_month, start_year, end_month, end_year, is_current_role, duties",
      )
      .eq("application_id", applicationId)
      .order("created_at", { ascending: true }),
    client
      .from("professional_accreditations")
      .select("id, name, status, document_id, document_name")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: true }),
    client
      .from("secondary_qualifications")
      .select(
        "id, qualification_type, country, state, school, qualification_name, completion_year",
      )
      .eq("application_id", applicationId)
      .order("created_at", { ascending: true }),
    client
      .from("language_tests")
      .select("id, test_type, test_name, completion_year, document_id, document_name")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: true }),
  ]);

  if (applicationDocumentsResponse.error) throw applicationDocumentsResponse.error;
  if (tertiaryQualificationsResponse.error) throw tertiaryQualificationsResponse.error;
  if (employmentExperiencesResponse.error) throw employmentExperiencesResponse.error;
  if (professionalAccreditationsResponse.error) {
    throw professionalAccreditationsResponse.error;
  }
  if (secondaryQualificationsResponse.error) throw secondaryQualificationsResponse.error;
  if (languageTestsResponse.error) throw languageTestsResponse.error;

  const documentMap = new Map<string, UploadedDocument>(
    (
      applicationDocumentsResponse.data as RemoteApplicationDocumentRow[] | null
    )?.map((document) => [
      document.id,
      {
        id: document.id,
        name: document.file_name,
        size: document.size_bytes,
        type: document.mime_type,
        lastModified: Date.now(),
        uploadedAt: document.created_at,
        source: "remote",
        storageBucket: document.storage_bucket,
        storagePath: document.storage_path,
      } satisfies UploadedDocument,
    ]) ?? [],
  );

  return mergeStoredApplicationData({
    applicationMeta: {
      recordId: application.id,
      applicantProfileId: application.applicant_profile_id ?? undefined,
      applicationNumber: application.application_number ?? undefined,
      submittedAt: application.submitted_at ?? undefined,
      selectedCourse:
        application.course_code && application.course_title && application.intake_label
          ? {
              code: application.course_code,
              title: application.course_title,
              intake: application.intake_label,
            }
          : undefined,
    },
    personalDetails: application.personal_details ?? initialApplicationData.personalDetails,
    contactDetails: application.contact_details ?? initialApplicationData.contactDetails,
    cvUploaded: Boolean(application.cv_document_id || application.cv_file_name),
    cvDocument: application.cv_document_id
      ? documentMap.get(application.cv_document_id)
      : undefined,
    cvFileName: application.cv_file_name ?? undefined,
    tertiaryQualifications: (
      tertiaryQualificationsResponse.data as RemoteTertiaryQualificationRow[] | null
    )?.map<TertiaryQualification>((qualification) => ({
      id: qualification.id,
      institution: qualification.institution,
      country: qualification.country,
      level: qualification.level,
      courseName: qualification.course_name,
      startMonth: qualification.start_month,
      startYear: qualification.start_year,
      completed: qualification.completed,
      endMonth: qualification.end_month,
      endYear: qualification.end_year,
      transcriptDocument: qualification.transcript_document_id
        ? documentMap.get(qualification.transcript_document_id)
        : undefined,
      transcriptDocumentName:
        qualification.transcript_document_name ?? undefined,
      certificateDocument: qualification.certificate_document_id
        ? documentMap.get(qualification.certificate_document_id)
        : undefined,
      certificateDocumentName:
        qualification.certificate_document_name ?? undefined,
    })),
    employmentExperiences: (
      employmentExperiencesResponse.data as RemoteEmploymentExperienceRow[] | null
    )?.map<EmploymentExperience>((experience) => ({
      id: experience.id,
      company: experience.company,
      position: experience.position,
      type: experience.employment_type,
      startMonth: experience.start_month,
      startYear: experience.start_year,
      endMonth: experience.end_month ?? "",
      endYear: experience.end_year ?? "",
      currentRole: experience.is_current_role,
      duties: experience.duties,
    })),
    professionalAccreditations: (
      professionalAccreditationsResponse.data as
        | RemoteProfessionalAccreditationRow[]
        | null
    )?.map<ProfessionalAccreditation>((accreditation) => ({
      id: accreditation.id,
      name: accreditation.name,
      status: accreditation.status,
      document: accreditation.document_id
        ? documentMap.get(accreditation.document_id)
        : undefined,
      documentName: accreditation.document_name ?? undefined,
    })),
    secondaryQualifications: (
      secondaryQualificationsResponse.data as
        | RemoteSecondaryQualificationRow[]
        | null
    )?.map<SecondaryQualification>((qualification) => ({
      id: qualification.id,
      type: qualification.qualification_type,
      country: qualification.country,
      state: qualification.state,
      school: qualification.school,
      qualification: qualification.qualification_name,
      year: qualification.completion_year,
    })),
    languageTests: (
      languageTestsResponse.data as RemoteLanguageTestRow[] | null
    )?.map<LanguageTest>((test) => ({
      id: test.id,
      type: test.test_type,
      name: test.test_name,
      year: test.completion_year,
      document: test.document_id ? documentMap.get(test.document_id) : undefined,
      documentName: test.document_name ?? undefined,
    })),
  });
}

function getRemoteDocumentId(document?: UploadedDocument) {
  return document?.source === "remote" ? document.id : null;
}

async function upsertApplicantProfile(
  session: Session,
  data: ApplicationData,
): Promise<string | null> {
  const client = requireSupabaseClient();
  const profile = deriveApplicantProfileSeed(data);

  if (!profile) {
    return data.applicationMeta.applicantProfileId ?? null;
  }

  const payload = {
    id: data.applicationMeta.applicantProfileId ?? undefined,
    owner_user_id: session.user.id,
    email: profile.email,
    first_name: profile.firstName || null,
    last_name: profile.lastName || null,
    preferred_name: profile.preferredName || null,
    phone: profile.phone || null,
  };

  const profileQuery = data.applicationMeta.applicantProfileId
    ? client
        .from("applicant_profiles")
        .update(payload)
        .eq("id", data.applicationMeta.applicantProfileId)
        .eq("owner_user_id", session.user.id)
        .select("id")
        .single()
    : client
        .from("applicant_profiles")
        .upsert(payload, { onConflict: "owner_user_id,email" })
        .select("id")
        .single();

  const { data: profileRow, error } = await profileQuery;

  if (error) {
    throw error;
  }

  return (profileRow as { id: string }).id;
}

export async function saveRemoteApplication(
  session: Session,
  data: ApplicationData,
  options?: { forceCreate?: boolean },
): Promise<RemoteSaveResult | null> {
  const client = requireSupabaseClient();

  if (
    !options?.forceCreate &&
    !hasStartedApplication(data) &&
    !data.applicationMeta.applicationNumber &&
    !data.applicationMeta.submittedAt
  ) {
    return data.applicationMeta.recordId
      ? {
          applicationId: data.applicationMeta.recordId,
          applicantProfileId: data.applicationMeta.applicantProfileId ?? null,
        }
      : null;
  }

  const applicantProfileId = await upsertApplicantProfile(session, data);

  const applicationPayload = {
    id: data.applicationMeta.recordId ?? undefined,
    user_id: session.user.id,
    applicant_profile_id: applicantProfileId,
    status: data.applicationMeta.submittedAt ? "submitted" : "draft",
    application_number: data.applicationMeta.applicationNumber ?? null,
    submitted_at: data.applicationMeta.submittedAt ?? null,
    course_code: data.applicationMeta.selectedCourse?.code ?? APPLICATION_COURSE.code,
    course_title:
      data.applicationMeta.selectedCourse?.title ?? APPLICATION_COURSE.title,
    intake_label:
      data.applicationMeta.selectedCourse?.intake ?? APPLICATION_COURSE.intake,
    personal_details: data.personalDetails,
    contact_details: data.contactDetails,
    cv_document_id: getRemoteDocumentId(data.cvDocument),
    cv_file_name: data.cvFileName ?? null,
  };

  const applicationQuery = data.applicationMeta.recordId
    ? client
        .from("applications")
        .update(applicationPayload)
        .eq("id", data.applicationMeta.recordId)
        .select("id")
        .single()
    : client
        .from("applications")
        .insert(applicationPayload)
        .select("id")
        .single();

  const { data: applicationRow, error: applicationError } = await applicationQuery;

  if (applicationError) {
    throw applicationError;
  }

  const applicationId = (applicationRow as { id: string }).id;

  await Promise.all([
    client.from("tertiary_qualifications").delete().eq("application_id", applicationId),
    client.from("employment_experiences").delete().eq("application_id", applicationId),
    client
      .from("professional_accreditations")
      .delete()
      .eq("application_id", applicationId),
    client.from("secondary_qualifications").delete().eq("application_id", applicationId),
    client.from("language_tests").delete().eq("application_id", applicationId),
  ]);

  if (data.tertiaryQualifications.length > 0) {
    const { error } = await client.from("tertiary_qualifications").insert(
      data.tertiaryQualifications.map((qualification) => ({
        id: qualification.id,
        application_id: applicationId,
        institution: qualification.institution,
        country: qualification.country,
        level: qualification.level,
        course_name: qualification.courseName,
        start_month: qualification.startMonth,
        start_year: qualification.startYear,
        completed: qualification.completed,
        end_month: qualification.endMonth,
        end_year: qualification.endYear,
        transcript_document_id: getRemoteDocumentId(
          qualification.transcriptDocument,
        ),
        transcript_document_name: qualification.transcriptDocumentName ?? null,
        certificate_document_id: getRemoteDocumentId(
          qualification.certificateDocument,
        ),
        certificate_document_name:
          qualification.certificateDocumentName ?? null,
      })),
    );

    if (error) {
      throw error;
    }
  }

  if (data.employmentExperiences.length > 0) {
    const { error } = await client.from("employment_experiences").insert(
      data.employmentExperiences.map((experience) => ({
        id: experience.id,
        application_id: applicationId,
        company: experience.company,
        position: experience.position,
        employment_type: experience.type,
        start_month: experience.startMonth,
        start_year: experience.startYear,
        end_month: experience.endMonth || null,
        end_year: experience.endYear || null,
        is_current_role: experience.currentRole,
        duties: experience.duties,
      })),
    );

    if (error) {
      throw error;
    }
  }

  if (data.professionalAccreditations.length > 0) {
    const { error } = await client.from("professional_accreditations").insert(
      data.professionalAccreditations.map((accreditation) => ({
        id: accreditation.id,
        application_id: applicationId,
        name: accreditation.name,
        status: accreditation.status,
        document_id: getRemoteDocumentId(accreditation.document),
        document_name: accreditation.documentName ?? null,
      })),
    );

    if (error) {
      throw error;
    }
  }

  if (data.secondaryQualifications.length > 0) {
    const { error } = await client.from("secondary_qualifications").insert(
      data.secondaryQualifications.map((qualification) => ({
        id: qualification.id,
        application_id: applicationId,
        qualification_type: qualification.type,
        country: qualification.country,
        state: qualification.state,
        school: qualification.school,
        qualification_name: qualification.qualification,
        completion_year: qualification.year,
      })),
    );

    if (error) {
      throw error;
    }
  }

  if (data.languageTests.length > 0) {
    const { error } = await client.from("language_tests").insert(
      data.languageTests.map((test) => ({
        id: test.id,
        application_id: applicationId,
        test_type: test.type,
        test_name: test.name,
        completion_year: test.year,
        document_id: getRemoteDocumentId(test.document),
        document_name: test.documentName ?? null,
      })),
    );

    if (error) {
      throw error;
    }
  }

  return {
    applicationId,
    applicantProfileId,
  };
}

export async function submitRemoteApplication(
  session: Session,
  data: ApplicationData,
): Promise<RemoteSubmissionResult> {
  const saveResult = await saveRemoteApplication(session, data, {
    forceCreate: true,
  });
  const applicationId = saveResult?.applicationId ?? data.applicationMeta.recordId;

  if (!applicationId) {
    throw new Error("Unable to prepare the application for submission.");
  }

  const client = requireSupabaseClient();
  const { data: submissionResult, error } = await client.rpc("submit_application", {
    target_application_id: applicationId,
  });

  if (error) {
    throw error;
  }

  return submissionResult as RemoteSubmissionResult;
}

export async function deleteRemoteApplication(session: Session, recordId: string) {
  const client = requireSupabaseClient();
  const { error } = await client.from("applications").delete().eq("id", recordId).eq(
    "user_id",
    session.user.id,
  );

  if (error) {
    throw error;
  }
}
