import { getCourseByCode, getDefaultCourse } from "../courseCatalog";
import type {
  ContactDetails,
  EmploymentExperience,
  LanguageTest,
  PersonalDetails,
  ProfessionalAccreditation,
  SecondaryQualification,
  TertiaryQualification,
} from "../applicationData";
import type { UploadedDocument } from "../documentStorage";
import type { Json, Tables, TablesInsert } from "../supabase.types";

/**
 * Pure row <-> domain mapping helpers for the remote (Supabase) store.
 *
 * Everything here is free of network access so it can be unit-tested directly;
 * `remoteStore.ts` owns the queries and composes these mappers.
 */

// --- Row shapes (subsets of generated tables, matching the store's selects) ---

export type RemoteApplicationRow = Pick<
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

export type RemoteApplicationDocumentRow = Pick<
  Tables<"application_documents">,
  | "created_at"
  | "file_name"
  | "id"
  | "mime_type"
  | "size_bytes"
  | "storage_bucket"
  | "storage_path"
>;

type TertiaryRow = Pick<
  Tables<"tertiary_qualifications">,
  | "certificate_document_id"
  | "certificate_document_name"
  | "completed"
  | "country"
  | "course_name"
  | "end_month"
  | "end_year"
  | "id"
  | "institution"
  | "level"
  | "start_month"
  | "start_year"
  | "transcript_document_id"
  | "transcript_document_name"
>;

type EmploymentRow = Pick<
  Tables<"employment_experiences">,
  | "company"
  | "duties"
  | "employment_type"
  | "end_month"
  | "end_year"
  | "id"
  | "is_current_role"
  | "position"
  | "start_month"
  | "start_year"
>;

type ProfessionalRow = Pick<
  Tables<"professional_accreditations">,
  "document_id" | "document_name" | "id" | "name" | "status"
>;

type SecondaryRow = Pick<
  Tables<"secondary_qualifications">,
  | "completion_year"
  | "country"
  | "id"
  | "qualification_name"
  | "qualification_type"
  | "school"
  | "state"
>;

type LanguageRow = Pick<
  Tables<"language_tests">,
  "completion_year" | "document_id" | "document_name" | "id" | "test_name" | "test_type"
>;

export interface RemoteSelectedCourse {
  code: string;
  title: string;
  provider: string;
  intake: string;
}

// --- JSON coercion ---

function isJsonObject(value: Json): value is { [key: string]: Json | undefined } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function toContactDetails(value: Json): ContactDetails | undefined {
  return isJsonObject(value) ? (value as unknown as ContactDetails) : undefined;
}

export function toPersonalDetails(value: Json): PersonalDetails | undefined {
  return isJsonObject(value) ? (value as unknown as PersonalDetails) : undefined;
}

export function toJsonValue<T>(value: T | undefined): Json | undefined {
  return value as unknown as Json | undefined;
}

// --- Identifier helpers ---

export function getRemoteDocumentId(document?: UploadedDocument) {
  return document?.source === "remote" ? document.id : null;
}

export function getRemoteUuid(id: string | undefined) {
  return id &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    )
    ? id
    : undefined;
}

/**
 * Resolves the display course for an application row, falling back to the
 * matching catalog course and then the default course for each field.
 */
export function resolveSelectedCourse(
  row: Pick<RemoteApplicationRow, "course_code" | "course_title" | "intake_label">,
): RemoteSelectedCourse {
  const defaultCourse = getDefaultCourse();
  const matchingCourse = getCourseByCode(row.course_code);

  return {
    code: row.course_code ?? matchingCourse?.code ?? defaultCourse.code,
    title: row.course_title ?? matchingCourse?.title ?? defaultCourse.title,
    provider: matchingCourse?.provider ?? defaultCourse.provider,
    intake: row.intake_label ?? matchingCourse?.intakeLabel ?? defaultCourse.intakeLabel,
  };
}

// --- Row -> domain mappers (load) ---

export function mapRemoteDocument(
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

export function mapEmploymentRow(experience: EmploymentRow): EmploymentExperience {
  return {
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
  };
}

export function mapLanguageTestRow(
  test: LanguageRow,
  documentMap: Map<string, UploadedDocument>,
): LanguageTest {
  return {
    document: test.document_id ? documentMap.get(test.document_id) : undefined,
    documentName: test.document_name ?? undefined,
    id: test.id,
    name: test.test_name,
    type: test.test_type,
    year: test.completion_year,
  };
}

export function mapProfessionalAccreditationRow(
  accreditation: ProfessionalRow,
  documentMap: Map<string, UploadedDocument>,
): ProfessionalAccreditation {
  return {
    document: accreditation.document_id
      ? documentMap.get(accreditation.document_id)
      : undefined,
    documentName: accreditation.document_name ?? undefined,
    id: accreditation.id,
    name: accreditation.name,
    status: accreditation.status,
  };
}

export function mapSecondaryQualificationRow(
  qualification: SecondaryRow,
): SecondaryQualification {
  return {
    country: qualification.country,
    id: qualification.id,
    qualification: qualification.qualification_name,
    school: qualification.school,
    state: qualification.state,
    type: qualification.qualification_type,
    year: qualification.completion_year,
  };
}

export function mapTertiaryQualificationRow(
  qualification: TertiaryRow,
  documentMap: Map<string, UploadedDocument>,
): TertiaryQualification {
  return {
    certificateDocument: qualification.certificate_document_id
      ? documentMap.get(qualification.certificate_document_id)
      : undefined,
    certificateDocumentName: qualification.certificate_document_name ?? undefined,
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
    transcriptDocumentName: qualification.transcript_document_name ?? undefined,
  };
}

// --- Domain -> insert-row builders (save) ---

export function toTertiaryInsert(
  applicationId: string,
  qualification: TertiaryQualification,
): TablesInsert<"tertiary_qualifications"> {
  return {
    application_id: applicationId,
    certificate_document_id: getRemoteDocumentId(qualification.certificateDocument),
    certificate_document_name: qualification.certificateDocumentName ?? null,
    completed: qualification.completed,
    country: qualification.country,
    course_name: qualification.courseName,
    end_month: qualification.endMonth,
    end_year: qualification.endYear,
    id: getRemoteUuid(qualification.id),
    institution: qualification.institution,
    level: qualification.level,
    start_month: qualification.startMonth,
    start_year: qualification.startYear,
    transcript_document_id: getRemoteDocumentId(qualification.transcriptDocument),
    transcript_document_name: qualification.transcriptDocumentName ?? null,
  };
}

export function toEmploymentInsert(
  applicationId: string,
  experience: EmploymentExperience,
): TablesInsert<"employment_experiences"> {
  return {
    application_id: applicationId,
    company: experience.company,
    duties: experience.duties,
    employment_type: experience.type,
    end_month: experience.endMonth || null,
    end_year: experience.endYear || null,
    id: getRemoteUuid(experience.id),
    is_current_role: experience.currentRole,
    position: experience.position,
    start_month: experience.startMonth,
    start_year: experience.startYear,
  };
}

export function toProfessionalAccreditationInsert(
  applicationId: string,
  accreditation: ProfessionalAccreditation,
): TablesInsert<"professional_accreditations"> {
  return {
    application_id: applicationId,
    document_id: getRemoteDocumentId(accreditation.document),
    document_name: accreditation.documentName ?? null,
    id: getRemoteUuid(accreditation.id),
    name: accreditation.name,
    status: accreditation.status,
  };
}

export function toSecondaryQualificationInsert(
  applicationId: string,
  qualification: SecondaryQualification,
): TablesInsert<"secondary_qualifications"> {
  return {
    application_id: applicationId,
    completion_year: qualification.year,
    country: qualification.country,
    id: getRemoteUuid(qualification.id),
    qualification_name: qualification.qualification,
    qualification_type: qualification.type,
    school: qualification.school,
    state: qualification.state,
  };
}

export function toLanguageTestInsert(
  applicationId: string,
  test: LanguageTest,
): TablesInsert<"language_tests"> {
  return {
    application_id: applicationId,
    completion_year: test.year,
    document_id: getRemoteDocumentId(test.document),
    document_name: test.documentName ?? null,
    id: getRemoteUuid(test.id),
    test_name: test.name,
    test_type: test.type,
  };
}
