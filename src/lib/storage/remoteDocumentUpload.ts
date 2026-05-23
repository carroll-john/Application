import { inferDocumentMimeType } from "../documentMime";
import { buildApplicationDocumentStoragePath } from "../documentStoragePath";
import { supabase } from "../supabase";
import type { Enums, Tables, TablesInsert } from "../supabase.types";
import {
  assertDocumentUploadFileSize,
  DocumentUploadLimitError,
  REMOTE_UPLOAD_MAX_FILES_PER_APPLICATION,
  REMOTE_UPLOAD_MAX_TOTAL_BYTES_PER_APPLICATION,
  REMOTE_UPLOAD_RATE_LIMIT_MAX_UPLOADS,
  REMOTE_UPLOAD_RATE_LIMIT_WINDOW_MINUTES,
  toDocumentUploadLimitError,
} from "../documentUploadLimits";
import { getSupabaseSession, REMOTE_STORAGE_BUCKET } from "./documentDelivery";
import type { UploadedDocument } from "./documentTypes";

type RemoteDocumentRow = Pick<
  Tables<"application_documents">,
  | "id"
  | "file_name"
  | "size_bytes"
  | "mime_type"
  | "created_at"
  | "storage_bucket"
  | "storage_path"
>;

async function enforceRemoteUploadLimits(
  applicationId: string,
  userId: string,
  nextFileSizeBytes: number,
) {
  if (!supabase) {
    return;
  }

  assertDocumentUploadFileSize(nextFileSizeBytes);

  const { data: applicationDocuments, error: applicationDocumentsError } =
    await supabase
      .from("application_documents")
      .select("size_bytes")
      .eq("application_id", applicationId);

  if (applicationDocumentsError) {
    throw applicationDocumentsError;
  }

  const existingDocuments = applicationDocuments ?? [];
  const existingCount = existingDocuments.length;
  const existingTotalBytes = existingDocuments.reduce(
    (sum, document) => sum + document.size_bytes,
    0,
  );

  if (existingCount >= REMOTE_UPLOAD_MAX_FILES_PER_APPLICATION) {
    throw new DocumentUploadLimitError("UPLOAD_APP_FILE_COUNT_LIMIT", {
      limit: REMOTE_UPLOAD_MAX_FILES_PER_APPLICATION,
    });
  }

  if (
    existingTotalBytes + nextFileSizeBytes >
    REMOTE_UPLOAD_MAX_TOTAL_BYTES_PER_APPLICATION
  ) {
    throw new DocumentUploadLimitError("UPLOAD_APP_TOTAL_BYTES_LIMIT", {
      limit: REMOTE_UPLOAD_MAX_TOTAL_BYTES_PER_APPLICATION,
    });
  }

  const { data: userApplications, error: userApplicationsError } = await supabase
    .from("applications")
    .select("id")
    .eq("user_id", userId);

  if (userApplicationsError) {
    throw userApplicationsError;
  }

  const applicationIds = (userApplications ?? []).map(
    (application) => application.id,
  );

  if (applicationIds.length === 0) {
    return;
  }

  const windowStartIso = new Date(
    Date.now() - REMOTE_UPLOAD_RATE_LIMIT_WINDOW_MINUTES * 60_000,
  ).toISOString();

  const { count, error: recentUploadError } = await supabase
    .from("application_documents")
    .select("id", { count: "exact", head: true })
    .in("application_id", applicationIds)
    .gte("created_at", windowStartIso);

  if (recentUploadError) {
    throw recentUploadError;
  }

  if ((count ?? 0) >= REMOTE_UPLOAD_RATE_LIMIT_MAX_UPLOADS) {
    throw new DocumentUploadLimitError("UPLOAD_RATE_LIMIT", {
      limit: REMOTE_UPLOAD_RATE_LIMIT_MAX_UPLOADS,
      windowMinutes: REMOTE_UPLOAD_RATE_LIMIT_WINDOW_MINUTES,
    });
  }
}

function toUploadedDocument(
  document: RemoteDocumentRow,
  lastModified = Date.now(),
): UploadedDocument {
  return {
    id: document.id,
    name: document.file_name,
    size: document.size_bytes,
    type: document.mime_type,
    lastModified,
    uploadedAt: document.created_at,
    source: "remote",
    storageBucket: document.storage_bucket,
    storagePath: document.storage_path,
  };
}

export async function saveRemoteDocumentFile(
  file: File,
  applicationId: string,
  kind: Enums<"document_kind">,
): Promise<UploadedDocument> {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const session = await getSupabaseSession();

  if (!session) {
    throw new Error("No authenticated session is available.");
  }

  await enforceRemoteUploadLimits(applicationId, session.user.id, file.size);

  const documentId = crypto.randomUUID();
  const storagePath = buildApplicationDocumentStoragePath({
    userId: session.user.id,
    applicationId,
    kind,
    documentId,
    fileName: file.name,
  });
  const mimeType = inferDocumentMimeType(file);

  const { error: uploadError } = await supabase.storage
    .from(REMOTE_STORAGE_BUCKET)
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: mimeType,
    });

  if (uploadError) {
    const limitError = toDocumentUploadLimitError(uploadError);

    if (limitError) {
      throw limitError;
    }

    throw uploadError;
  }

  const remoteRow: TablesInsert<"application_documents"> = {
    id: documentId,
    application_id: applicationId,
    kind,
    storage_bucket: REMOTE_STORAGE_BUCKET,
    storage_path: storagePath,
    file_name: file.name,
    mime_type: mimeType,
    size_bytes: file.size,
  };

  const { data, error } = await supabase
    .from("application_documents")
    .insert(remoteRow)
    .select(
      "id, file_name, size_bytes, mime_type, created_at, storage_bucket, storage_path",
    )
    .single();

  if (error) {
    await supabase.storage.from(REMOTE_STORAGE_BUCKET).remove([storagePath]);
    const limitError = toDocumentUploadLimitError(error);

    if (limitError) {
      throw limitError;
    }

    throw error;
  }

  if (!data) {
    throw new Error("Failed to store the uploaded document metadata.");
  }

  return toUploadedDocument(data, file.lastModified);
}
