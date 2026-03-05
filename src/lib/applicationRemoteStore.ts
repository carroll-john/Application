import type { Session } from "@supabase/supabase-js";
import { getCourseByCode, getDefaultCourse } from "./courseCatalog";
import {
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
import {
  summarizeApplication,
  type ApplicationSummary,
} from "./applicationRecords";
import type { UploadedDocument } from "./documentStorage";
import type { Json, Tables, TablesInsert } from "./supabase.types";
import { supabase } from "./supabase";

type RemoteApplicationRow = Pick<
  Tables<"applications">,
  | "applicant_profile_id"
  | "application_number"
  | "contact_details"
  | "course_code"
  | "course_title"
  | "created_at"
  | "cv_document_id"
  | "cv_file_name"
  | "id"
  | "intake_label"
  | "personal_details"
  | "status"
  | "submitted_at"
  | "updated_at"
>;
type RemoteApplicationDocumentRow = Pick<
  Tables<"application_documents">,
  | "created_at"
  | "file_name"
  | "id"
  | "mime_type"
  | "size_bytes"
  | "storage_bucket"
  | "storage_path"
>;

interface RemoteSubmissionResult {
  applicationId: string;
  applicationNumber: string;
  submittedAt: string;
}

export interface RemoteSaveResult {
  applicationId: string;
  applicantProfileId: string | null;
  applicationNumber?: string;
  submittedAt?: string | null;
  updatedAt: string;
}

function isJsonObject(value: Json): value is { [key: string]: Json | undefined } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toContactDetails(value: Json): ContactDetails | undefined {
  return isJsonObject(value) ? (value as unknown as ContactDetails) : undefined;
}

function toPersonalDetails(value: Json): PersonalDetails | undefined {
  return isJsonObject(value) ? (value as unknown as PersonalDetails) : undefined;
}

function toJsonValue<T>(value: T | undefined): Json | undefined {
  return value as unknown as Json | undefined;
}

function isRemoteSubmissionResult(value: unknown): value is RemoteSubmissionResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.applicationId === "string" &&
    typeof candidate.applicationNumber === "string" &&
    typeof candidate.submittedAt === "string"
  );
}

function requireSupabaseClient() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  return supabase;
}

function mapRemoteDocument(
  document: RemoteApplicationDocumentRow,
): UploadedDocument {
  return {
    id: document.id,
    name: document.file_name,
    size: document.size_bytes,
    type: document.mime_type,
    lastModified: Date.now(),
    uploadedAt: document.created_at,
    source: "remote",
    storageBucket: document.storage_bucket,
    storagePath: document.storage_path,
  };
}

function mapApplicationSummary(row: RemoteApplicationRow): ApplicationSummary | null {
  const defaultCourse = getDefaultCourse();
  const matchingCourse = getCourseByCode(row.course_code);

  return summarizeApplication({
    applicationMeta: {
      applicantProfileId: row.applicant_profile_id ?? undefined,
      applicationNumber: row.application_number ?? undefined,
      createdAt: row.created_at,
      recordId: row.id,
      selectedCourse: {
        code: row.course_code ?? matchingCourse?.code ?? defaultCourse.code,
        title: row.course_title ?? matchingCourse?.title ?? defaultCourse.title,
        provider: matchingCourse?.provider ?? defaultCourse.provider,
        intake: row.intake_label ?? matchingCourse?.intakeLabel ?? defaultCourse.intakeLabel,
      },
      status: row.status,
      submittedAt: row.submitted_at ?? undefined,
      updatedAt: row.updated_at,
    },
    contactDetails: toContactDetails(row.contact_details),
    cvDocument: undefined,
    cvFileName: row.cv_file_name ?? undefined,
    cvUploaded: Boolean(row.cv_document_id || row.cv_file_name),
    employmentExperiences: [],
    languageTests: [],
    personalDetails: toPersonalDetails(row.personal_details),
    professionalAccreditations: [],
    secondaryQualifications: [],
    tertiaryQualifications: [],
  } as ApplicationData);
}

async function fetchRemoteApplicationRow(
  session: Session,
  applicationId: string,
): Promise<RemoteApplicationRow | null> {
  const client = requireSupabaseClient();

  const { data, error } = await client
    .from("applications")
    .select(
      "id, applicant_profile_id, application_number, course_code, course_title, intake_label, personal_details, contact_details, cv_document_id, cv_file_name, status, submitted_at, created_at, updated_at",
    )
    .eq("id", applicationId)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function listRemoteApplications(
  session: Session,
): Promise<ApplicationSummary[]> {
  const client = requireSupabaseClient();

  const { data, error } = await client
    .from("applications")
    .select(
      "id, applicant_profile_id, application_number, course_code, course_title, intake_label, personal_details, contact_details, cv_document_id, cv_file_name, status, submitted_at, created_at, updated_at",
    )
    .eq("user_id", session.user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((row) => mapApplicationSummary(row))
    .filter((summary): summary is ApplicationSummary => Boolean(summary));
}

export async function loadRemoteApplicationById(
  session: Session,
  applicationId: string,
): Promise<ApplicationData | null> {
  const client = requireSupabaseClient();
  const application = await fetchRemoteApplicationRow(session, applicationId);

  if (!application) {
    return null;
  }

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
    (applicationDocumentsResponse.data ?? []).map((document) => [
      document.id,
      mapRemoteDocument(document),
    ]),
  );
  const defaultCourse = getDefaultCourse();
  const matchingCourse = getCourseByCode(application.course_code);

  return mergeStoredApplicationData({
    applicationMeta: {
      applicantProfileId: application.applicant_profile_id ?? undefined,
      applicationNumber: application.application_number ?? undefined,
      createdAt: application.created_at,
      recordId: application.id,
      selectedCourse: {
        code: application.course_code ?? matchingCourse?.code ?? defaultCourse.code,
        title:
          application.course_title ?? matchingCourse?.title ?? defaultCourse.title,
        provider: matchingCourse?.provider ?? defaultCourse.provider,
        intake:
          application.intake_label ??
          matchingCourse?.intakeLabel ??
          defaultCourse.intakeLabel,
      },
      status: application.status,
      submittedAt: application.submitted_at ?? undefined,
      updatedAt: application.updated_at,
    },
    contactDetails: toContactDetails(application.contact_details),
    cvDocument: application.cv_document_id
      ? documentMap.get(application.cv_document_id)
      : undefined,
    cvFileName: application.cv_file_name ?? undefined,
    cvUploaded: Boolean(application.cv_document_id || application.cv_file_name),
    employmentExperiences: (employmentExperiencesResponse.data ?? []).map<
      EmploymentExperience
    >((experience) => ({
      company: experience.company,
      currentRole: experience.is_current_role,
      duties: experience.duties,
      endMonth: experience.end_month ?? "",
      endYear: experience.end_year ?? "",
      id: experience.id,
      position: experience.position,
      startMonth: experience.start_month,
      startYear: experience.start_year,
      type: experience.employment_type,
    })),
    languageTests: (languageTestsResponse.data ?? []).map<LanguageTest>((test) => ({
      document: test.document_id ? documentMap.get(test.document_id) : undefined,
      documentName: test.document_name ?? undefined,
      id: test.id,
      name: test.test_name,
      type: test.test_type,
      year: test.completion_year,
    })),
    personalDetails: toPersonalDetails(application.personal_details),
    professionalAccreditations: (professionalAccreditationsResponse.data ?? []).map<
      ProfessionalAccreditation
    >((accreditation) => ({
      document: accreditation.document_id
        ? documentMap.get(accreditation.document_id)
        : undefined,
      documentName: accreditation.document_name ?? undefined,
      id: accreditation.id,
      name: accreditation.name,
      status: accreditation.status,
    })),
    secondaryQualifications: (secondaryQualificationsResponse.data ?? []).map<
      SecondaryQualification
    >((qualification) => ({
      country: qualification.country,
      id: qualification.id,
      qualification: qualification.qualification_name,
      school: qualification.school,
      state: qualification.state,
      type: qualification.qualification_type,
      year: qualification.completion_year,
    })),
    tertiaryQualifications: (tertiaryQualificationsResponse.data ?? []).map<
      TertiaryQualification
    >((qualification) => ({
      certificateDocument: qualification.certificate_document_id
        ? documentMap.get(qualification.certificate_document_id)
        : undefined,
      certificateDocumentName:
        qualification.certificate_document_name ?? undefined,
      completed: qualification.completed,
      country: qualification.country,
      courseName: qualification.course_name,
      endMonth: qualification.end_month,
      endYear: qualification.end_year,
      id: qualification.id,
      institution: qualification.institution,
      level: qualification.level,
      startMonth: qualification.start_month,
      startYear: qualification.start_year,
      transcriptDocument: qualification.transcript_document_id
        ? documentMap.get(qualification.transcript_document_id)
        : undefined,
      transcriptDocumentName:
        qualification.transcript_document_name ?? undefined,
    })),
  });
}

function getRemoteDocumentId(document?: UploadedDocument) {
  return document?.source === "remote" ? document.id : null;
}

export async function saveRemoteApplication(
  session: Session,
  data: ApplicationData,
  options?: { applicantProfileId?: string | null; forceCreate?: boolean },
): Promise<RemoteSaveResult | null> {
  const client = requireSupabaseClient();

  if (
    !options?.forceCreate &&
    !data.applicationMeta.recordId &&
    !data.applicationMeta.selectedCourse
  ) {
    return null;
  }

  const defaultCourse = getDefaultCourse();
  const selectedCourse = data.applicationMeta.selectedCourse;
  const applicationPayload: TablesInsert<"applications"> = {
    applicant_profile_id:
      options?.applicantProfileId ??
      data.applicationMeta.applicantProfileId ??
      null,
    application_number: data.applicationMeta.applicationNumber ?? null,
    contact_details: toJsonValue(data.contactDetails),
    course_code: selectedCourse?.code ?? defaultCourse.code,
    course_title: selectedCourse?.title ?? defaultCourse.title,
    cv_document_id: getRemoteDocumentId(data.cvDocument),
    cv_file_name: data.cvFileName ?? null,
    id: data.applicationMeta.recordId ?? undefined,
    intake_label: selectedCourse?.intake ?? defaultCourse.intakeLabel,
    personal_details: toJsonValue(data.personalDetails),
    status: data.applicationMeta.submittedAt ? "submitted" : "draft",
    submitted_at: data.applicationMeta.submittedAt ?? null,
    user_id: session.user.id,
  };

  const applicationQuery = data.applicationMeta.recordId
    ? client
        .from("applications")
        .update(applicationPayload)
        .eq("id", data.applicationMeta.recordId)
        .eq("user_id", session.user.id)
        .select("id, applicant_profile_id, application_number, submitted_at, updated_at")
        .single()
    : client
        .from("applications")
        .insert(applicationPayload)
        .select("id, applicant_profile_id, application_number, submitted_at, updated_at")
        .single();

  const { data: applicationRow, error: applicationError } = await applicationQuery;

  if (applicationError) {
    throw applicationError;
  }

  if (!applicationRow) {
    throw new Error("Failed to save the application.");
  }

  const applicationId = applicationRow.id;

  const deleteResponses = await Promise.all([
    client.from("tertiary_qualifications").delete().eq("application_id", applicationId),
    client.from("employment_experiences").delete().eq("application_id", applicationId),
    client
      .from("professional_accreditations")
      .delete()
      .eq("application_id", applicationId),
    client.from("secondary_qualifications").delete().eq("application_id", applicationId),
    client.from("language_tests").delete().eq("application_id", applicationId),
  ]);

  for (const response of deleteResponses) {
    if (response.error) {
      throw response.error;
    }
  }

  if (data.tertiaryQualifications.length > 0) {
    const { error } = await client.from("tertiary_qualifications").insert(
      data.tertiaryQualifications.map((qualification) => ({
        application_id: applicationId,
        certificate_document_id: getRemoteDocumentId(
          qualification.certificateDocument,
        ),
        certificate_document_name:
          qualification.certificateDocumentName ?? null,
        completed: qualification.completed,
        country: qualification.country,
        course_name: qualification.courseName,
        end_month: qualification.endMonth,
        end_year: qualification.endYear,
        id: qualification.id,
        institution: qualification.institution,
        level: qualification.level,
        start_month: qualification.startMonth,
        start_year: qualification.startYear,
        transcript_document_id: getRemoteDocumentId(
          qualification.transcriptDocument,
        ),
        transcript_document_name: qualification.transcriptDocumentName ?? null,
      })),
    );

    if (error) throw error;
  }

  if (data.employmentExperiences.length > 0) {
    const { error } = await client.from("employment_experiences").insert(
      data.employmentExperiences.map((experience) => ({
        application_id: applicationId,
        company: experience.company,
        duties: experience.duties,
        employment_type: experience.type,
        end_month: experience.endMonth || null,
        end_year: experience.endYear || null,
        id: experience.id,
        is_current_role: experience.currentRole,
        position: experience.position,
        start_month: experience.startMonth,
        start_year: experience.startYear,
      })),
    );

    if (error) throw error;
  }

  if (data.professionalAccreditations.length > 0) {
    const { error } = await client.from("professional_accreditations").insert(
      data.professionalAccreditations.map((accreditation) => ({
        application_id: applicationId,
        document_id: getRemoteDocumentId(accreditation.document),
        document_name: accreditation.documentName ?? null,
        id: accreditation.id,
        name: accreditation.name,
        status: accreditation.status,
      })),
    );

    if (error) throw error;
  }

  if (data.secondaryQualifications.length > 0) {
    const { error } = await client.from("secondary_qualifications").insert(
      data.secondaryQualifications.map((qualification) => ({
        application_id: applicationId,
        completion_year: qualification.year,
        country: qualification.country,
        id: qualification.id,
        qualification_name: qualification.qualification,
        qualification_type: qualification.type,
        school: qualification.school,
        state: qualification.state,
      })),
    );

    if (error) throw error;
  }

  if (data.languageTests.length > 0) {
    const { error } = await client.from("language_tests").insert(
      data.languageTests.map((test) => ({
        application_id: applicationId,
        completion_year: test.year,
        document_id: getRemoteDocumentId(test.document),
        document_name: test.documentName ?? null,
        id: test.id,
        test_name: test.name,
        test_type: test.type,
      })),
    );

    if (error) throw error;
  }

  return {
    applicantProfileId: applicationRow.applicant_profile_id ?? null,
    applicationId,
    applicationNumber: applicationRow.application_number ?? undefined,
    submittedAt: applicationRow.submitted_at ?? undefined,
    updatedAt: applicationRow.updated_at,
  };
}

export async function submitRemoteApplication(
  session: Session,
  data: ApplicationData,
): Promise<RemoteSubmissionResult> {
  const saveResult = await saveRemoteApplication(session, data, {
    applicantProfileId: data.applicationMeta.applicantProfileId ?? null,
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

  if (!isRemoteSubmissionResult(submissionResult)) {
    throw new Error("Unexpected submit_application RPC response.");
  }

  return submissionResult;
}

export async function deleteRemoteApplication(
  session: Session,
  recordId: string,
) {
  const client = requireSupabaseClient();
  const { error } = await client
    .from("applications")
    .delete()
    .eq("id", recordId)
    .eq("user_id", session.user.id);

  if (error) {
    throw error;
  }
}
