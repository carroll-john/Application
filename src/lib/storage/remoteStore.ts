import type { Session } from "@supabase/supabase-js";
import { getCourseByCode, getDefaultCourse } from "../courseCatalog";
import {
  mergeStoredApplicationData,
  type ApplicationData,
} from "../applicationData";
import {
  courseRequiresEnglishProficiency,
  getEnglishProficiencyRequirements,
} from "../eligibility/englishProficiencyEvidence";
import {
  summarizeApplication,
  type ApplicationSummary,
} from "../applicationRecords";
import { isSubmissionReadyDocument } from "../documentAttachment";
import type { UploadedDocument } from "../documentStorage";
import type { Tables, TablesInsert } from "../supabase.types";
import { supabase } from "../supabase";
import {
  getRemoteDocumentId,
  getRemoteUuid,
  mapEmploymentRow,
  findEligibilityFeedbackDocument,
  mapLanguageTestRow,
  mapProfessionalAccreditationRow,
  mapRemoteDocument,
  mapSecondaryQualificationRow,
  mapTertiaryQualificationRow,
  resolveSelectedCourse,
  toContactDetails,
  toEmploymentInsert,
  toJsonValue,
  toLanguageTestInsert,
  toPersonalDetails,
  toProfessionalAccreditationInsert,
  toSecondaryQualificationInsert,
  toTertiaryInsert,
  type RemoteApplicationRow,
} from "./remoteMappers";

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

type SavedApplicationRow = Pick<
  Tables<"applications">,
  "applicant_profile_id" | "application_number" | "id" | "submitted_at" | "updated_at"
>;

const APPLICATION_SELECT =
  "id, applicant_profile_id, application_number, course_code, course_title, intake_label, personal_details, contact_details, cv_document_id, cv_file_name, status, submitted_at, created_at, updated_at";
const SAVED_APPLICATION_SELECT =
  "id, applicant_profile_id, application_number, submitted_at, updated_at";

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

type SupabaseClient = ReturnType<typeof requireSupabaseClient>;

function mapApplicationSummary(row: RemoteApplicationRow): ApplicationSummary | null {
  return summarizeApplication(
    mergeStoredApplicationData({
      applicationMeta: {
        applicantProfileId: row.applicant_profile_id ?? undefined,
        applicationNumber: row.application_number ?? undefined,
        createdAt: row.created_at,
        recordId: row.id,
        selectedCourse: resolveSelectedCourse(row),
        status: row.status,
        submittedAt: row.submitted_at ?? undefined,
        updatedAt: row.updated_at,
      },
      contactDetails: toContactDetails(row.contact_details),
      cvDocument: undefined,
      cvFileName: row.cv_file_name ?? undefined,
      cvUploaded: false,
      employmentExperiences: [],
      languageTests: [],
      personalDetails: toPersonalDetails(row.personal_details),
      professionalAccreditations: [],
      secondaryQualifications: [],
      tertiaryQualifications: [],
    } as ApplicationData),
  );
}

async function fetchRemoteApplicationRow(
  session: Session,
  applicationId: string,
): Promise<RemoteApplicationRow | null> {
  // DIS-141: local- prefixed IDs are not valid UUIDs and must never reach
  // Supabase — Postgres would throw "invalid input syntax for type uuid".
  if (!getRemoteUuid(applicationId)) {
    console.error(
      `[remoteStore] Skipping remote fetch: applicationId is not a valid UUID ("${applicationId}"). ` +
        "The local ID was not replaced after the first remote sync.",
    );
    return null;
  }

  const client = requireSupabaseClient();

  const { data, error } = await client
    .from("applications")
    .select(APPLICATION_SELECT)
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
    .select(APPLICATION_SELECT)
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
        "id, file_name, size_bytes, mime_type, created_at, storage_bucket, storage_path, kind",
      )
      .eq("application_id", applicationId),
    client
      .from("tertiary_qualifications")
      .select(
        "id, institution, country, level, course_name, start_month, start_year, completed, end_month, end_year, transcript_confirms_completion, transcript_document_id, transcript_document_name, transcript_eligibility, certificate_document_id, certificate_document_name",
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
      .select(
        "id, test_type, test_name, completion_year, overall_score, listening_score, reading_score, writing_score, speaking_score, document_id, document_name",
      )
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
  const cvDocument = application.cv_document_id
    ? documentMap.get(application.cv_document_id)
    : undefined;
  const eligibilityFeedbackDocument = findEligibilityFeedbackDocument(
    applicationDocumentsResponse.data ?? [],
  );

  return mergeStoredApplicationData({
    applicationMeta: {
      applicantProfileId: application.applicant_profile_id ?? undefined,
      applicationNumber: application.application_number ?? undefined,
      createdAt: application.created_at,
      recordId: application.id,
      selectedCourse: resolveSelectedCourse(application),
      status: application.status,
      submittedAt: application.submitted_at ?? undefined,
      updatedAt: application.updated_at,
    },
    contactDetails: toContactDetails(application.contact_details),
    cvDocument,
    cvFileName: application.cv_file_name ?? undefined,
    cvUploaded: isSubmissionReadyDocument(cvDocument),
    eligibilityFeedbackDocument,
    eligibilityFeedbackFileName: eligibilityFeedbackDocument?.name,
    employmentExperiences: (employmentExperiencesResponse.data ?? []).map(mapEmploymentRow),
    languageTests: (languageTestsResponse.data ?? []).map((test) =>
      mapLanguageTestRow(test, documentMap),
    ),
    personalDetails: toPersonalDetails(application.personal_details),
    professionalAccreditations: (professionalAccreditationsResponse.data ?? []).map(
      (accreditation) => mapProfessionalAccreditationRow(accreditation, documentMap),
    ),
    secondaryQualifications: (secondaryQualificationsResponse.data ?? []).map(
      mapSecondaryQualificationRow,
    ),
    tertiaryQualifications: (tertiaryQualificationsResponse.data ?? []).map((qualification) =>
      mapTertiaryQualificationRow(qualification, documentMap),
    ),
  });
}

async function resolveExistingRemoteDocumentId(
  client: SupabaseClient,
  documentId: string | null,
): Promise<string | null> {
  if (!documentId) {
    return null;
  }

  const { data, error } = await client
    .from("application_documents")
    .select("id")
    .eq("id", documentId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.id ?? null;
}

function buildApplicationPayload(
  session: Session,
  data: ApplicationData,
  ids: {
    remoteApplicationId: string | undefined;
    remoteApplicantProfileId: string | null;
    remoteCvDocumentId: string | null;
  },
): TablesInsert<"applications"> {
  const defaultCourse = getDefaultCourse();
  const selectedCourse = data.applicationMeta.selectedCourse;
  const selectedCourseEntry = getCourseByCode(selectedCourse?.code ?? null);

  return {
    applicant_profile_id: ids.remoteApplicantProfileId,
    application_number: data.applicationMeta.applicationNumber ?? null,
    contact_details: toJsonValue(data.contactDetails),
    course_code: selectedCourse?.code ?? defaultCourse.code,
    course_title: selectedCourse?.title ?? defaultCourse.title,
    cv_document_id: ids.remoteCvDocumentId,
    cv_file_name: ids.remoteCvDocumentId ? data.cvFileName ?? null : null,
    id: ids.remoteApplicationId ?? undefined,
    intake_label: selectedCourse?.intake ?? defaultCourse.intakeLabel,
    personal_details: toJsonValue(data.personalDetails),
    // Persist whether the selected course requires English proficiency so the
    // submit RPC can enforce the conditional requirement (the catalog the client
    // derives this from is not available server-side).
    english_proficiency_policy: toJsonValue(
      getEnglishProficiencyRequirements(selectedCourseEntry),
    ),
    requires_english_proficiency: courseRequiresEnglishProficiency(selectedCourseEntry),
    status: data.applicationMeta.submittedAt ? "submitted" : "draft",
    submitted_at: data.applicationMeta.submittedAt ?? null,
    user_id: session.user.id,
  };
}

/** Updates the existing row when an id is known, otherwise inserts a fresh row. */
async function upsertApplicationRow(
  client: SupabaseClient,
  session: Session,
  payload: TablesInsert<"applications">,
  remoteApplicationId: string | undefined,
): Promise<SavedApplicationRow> {
  let applicationRow: SavedApplicationRow | null = null;

  if (remoteApplicationId) {
    const { data: updatedRow, error: updateError } = await client
      .from("applications")
      .update(payload)
      .eq("id", remoteApplicationId)
      .eq("user_id", session.user.id)
      .select(SAVED_APPLICATION_SELECT)
      .maybeSingle();

    if (updateError) {
      throw updateError;
    }

    applicationRow = updatedRow;
  }

  if (!applicationRow) {
    const { data: insertedRow, error: insertError } = await client
      .from("applications")
      .insert({ ...payload, id: undefined })
      .select(SAVED_APPLICATION_SELECT)
      .single();

    if (insertError) {
      throw insertError;
    }

    applicationRow = insertedRow;
  }

  if (!applicationRow) {
    throw new Error("Failed to save the application.");
  }

  return applicationRow;
}

interface ChildUpsertResponse {
  data: Array<{ id: string }> | null;
  error: { message: string } | null;
}

interface ChildPruneResponse {
  error: { message: string } | null;
}

/**
 * Replaces a single child-table collection for the application.
 *
 * The desired rows are upserted first (via `upsertRows`), then any rows for the
 * application that are no longer in the new set are pruned (via `pruneExcept`).
 * This is deliberately *not* a delete-all-then-insert: if the process failed
 * partway through that pattern (network blip, the tab closing, a rejected
 * insert) the DELETE could already have committed while the re-INSERT never
 * ran, permanently losing the applicant's data. Upserting first means a partial
 * failure leaves the prior rows intact, and the trailing prune only ever
 * removes rows the user actually deleted.
 *
 * DIS-140: the callers upsert with onConflict 'id' so the write stays
 * idempotent — if two saves race (double-click or retry), the second simply
 * overwrites the rows the first inserted instead of erroring on the
 * primary-key constraint.
 *
 * The per-table queries are passed as thunks so each call site keeps its
 * concrete (fully typed) Supabase table binding.
 */
async function rewriteChildTable(
  rowCount: number,
  upsertRows: () => PromiseLike<ChildUpsertResponse>,
  pruneExcept: (keptIds: string[]) => PromiseLike<ChildPruneResponse>,
): Promise<void> {
  const keptIds: string[] = [];

  if (rowCount > 0) {
    const { data, error } = await upsertRows();
    if (error) {
      throw error;
    }

    for (const row of data ?? []) {
      keptIds.push(row.id);
    }
  }

  const { error } = await pruneExcept(keptIds);
  if (error) {
    throw error;
  }
}

/** Replaces every child-table collection for the application. */
async function rewriteChildTables(
  client: SupabaseClient,
  applicationId: string,
  data: ApplicationData,
): Promise<void> {
  // Narrow the prior `delete().eq(...)` query to "id not in (kept)" so we only
  // remove rows the user actually deleted. Generic over the concrete filter
  // builder so each table keeps its own typing.
  const prune = <Query extends { not(column: "id", operator: "in", value: string): Query }>(
    query: Query,
    keptIds: string[],
  ): Query =>
    keptIds.length > 0 ? query.not("id", "in", `(${keptIds.join(",")})`) : query;

  await Promise.all([
    rewriteChildTable(
      data.tertiaryQualifications.length,
      () =>
        client
          .from("tertiary_qualifications")
          .upsert(
            data.tertiaryQualifications.map((q) => toTertiaryInsert(applicationId, q)),
            { onConflict: "id" },
          )
          .select("id"),
      (keptIds) =>
        prune(
          client
            .from("tertiary_qualifications")
            .delete()
            .eq("application_id", applicationId),
          keptIds,
        ),
    ),
    rewriteChildTable(
      data.employmentExperiences.length,
      () =>
        client
          .from("employment_experiences")
          .upsert(
            data.employmentExperiences.map((e) => toEmploymentInsert(applicationId, e)),
            { onConflict: "id" },
          )
          .select("id"),
      (keptIds) =>
        prune(
          client
            .from("employment_experiences")
            .delete()
            .eq("application_id", applicationId),
          keptIds,
        ),
    ),
    rewriteChildTable(
      data.professionalAccreditations.length,
      () =>
        client
          .from("professional_accreditations")
          .upsert(
            data.professionalAccreditations.map((a) =>
              toProfessionalAccreditationInsert(applicationId, a),
            ),
            { onConflict: "id" },
          )
          .select("id"),
      (keptIds) =>
        prune(
          client
            .from("professional_accreditations")
            .delete()
            .eq("application_id", applicationId),
          keptIds,
        ),
    ),
    rewriteChildTable(
      data.secondaryQualifications.length,
      () =>
        client
          .from("secondary_qualifications")
          .upsert(
            data.secondaryQualifications.map((q) =>
              toSecondaryQualificationInsert(applicationId, q),
            ),
            { onConflict: "id" },
          )
          .select("id"),
      (keptIds) =>
        prune(
          client
            .from("secondary_qualifications")
            .delete()
            .eq("application_id", applicationId),
          keptIds,
        ),
    ),
    rewriteChildTable(
      data.languageTests.length,
      () =>
        client
          .from("language_tests")
          .upsert(
            data.languageTests.map((t) => toLanguageTestInsert(applicationId, t)),
            { onConflict: "id" },
          )
          .select("id"),
      (keptIds) =>
        prune(
          client
            .from("language_tests")
            .delete()
            .eq("application_id", applicationId),
          keptIds,
        ),
    ),
  ]);
}

function toSaveResult(row: SavedApplicationRow): RemoteSaveResult {
  return {
    applicantProfileId: row.applicant_profile_id ?? null,
    applicationId: row.id,
    applicationNumber: row.application_number ?? undefined,
    submittedAt: row.submitted_at ?? undefined,
    updatedAt: row.updated_at,
  };
}

export async function saveRemoteApplication(
  session: Session,
  data: ApplicationData,
  options?: {
    applicantProfileId?: string | null;
    forceCreate?: boolean;
    shellOnly?: boolean;
  },
): Promise<RemoteSaveResult | null> {
  const client = requireSupabaseClient();

  if (
    !options?.forceCreate &&
    !data.applicationMeta.recordId &&
    !data.applicationMeta.selectedCourse
  ) {
    return null;
  }

  const remoteApplicationId = getRemoteUuid(data.applicationMeta.recordId);
  const remoteApplicantProfileId =
    getRemoteUuid(options?.applicantProfileId ?? undefined) ??
    getRemoteUuid(data.applicationMeta.applicantProfileId) ??
    null;
  const remoteCvDocumentId = await resolveExistingRemoteDocumentId(
    client,
    getRemoteDocumentId(data.cvDocument),
  );

  const applicationPayload = buildApplicationPayload(session, data, {
    remoteApplicationId,
    remoteApplicantProfileId,
    remoteCvDocumentId,
  });

  const applicationRow = await upsertApplicationRow(
    client,
    session,
    applicationPayload,
    remoteApplicationId,
  );

  if (options?.shellOnly) {
    return toSaveResult(applicationRow);
  }

  await rewriteChildTables(client, applicationRow.id, data);

  return toSaveResult(applicationRow);
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
  // DIS-141: guard against local- IDs that were never reconciled to a remote UUID.
  if (!getRemoteUuid(recordId)) {
    console.error(
      `[remoteStore] Skipping remote delete: recordId is not a valid UUID ("${recordId}").`,
    );
    return;
  }

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
