import { randomUUID } from "node:crypto";
import {
  inferMimeType,
  isFileBufferConsistentWithMimeType,
  isSupportedFile,
  MAX_FILE_SIZE_BYTES,
  toParsedUploadFile,
} from "../_documentParser/fileUpload.js";
import { UC_ASSESSMENT_PARTNER_ID } from "../../src/lib/assessment/ucGovernance.js";
import { assessmentHandler } from "../_assessment/handler.js";
import { scanAssessmentDocument } from "../_assessment/scanner.js";
import {
  AssessmentApiError,
  assessmentJson,
  createAssessmentAdminClient,
  getAssessmentUser,
  recordAssessmentAudit,
  requireAssessmentTreatmentEnabled,
  requireRateLimit,
  sha256,
} from "../_assessment/server.js";

async function handleDocument(request: Request) {
  if (request.method !== "POST") {
    throw new AssessmentApiError(
      "ASSESSMENT_METHOD_NOT_ALLOWED",
      "Method not allowed.",
      405,
    );
  }
  requireAssessmentTreatmentEnabled();
  const { user } = await getAssessmentUser(request);
  const admin = createAssessmentAdminClient();
  await requireRateLimit({
    admin,
    key: `assessment-document:${user.id}`,
    max: 6,
    windowSeconds: 60,
  });

  const formData = await request.formData();
  const sessionId = String(formData.get("sessionId") ?? "").trim();
  const kind = String(formData.get("kind") ?? "").trim();
  const file = toParsedUploadFile(formData.get("file"));
  if (!sessionId || kind !== "cv" || !file) {
    throw new AssessmentApiError(
      "ASSESSMENT_DOCUMENT_INVALID",
      "A treatment session and CV are required.",
      400,
    );
  }
  if (!isSupportedFile(file) || file.size > MAX_FILE_SIZE_BYTES) {
    throw new AssessmentApiError(
      "ASSESSMENT_FILE_UNSUPPORTED",
      "Use a PDF, DOC, DOCX or TXT CV smaller than 5 MB.",
      415,
    );
  }

  const { data: session, error: sessionError } = await admin
    .from("assessment_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("owner_user_id", user.id)
    .eq("partner_id", UC_ASSESSMENT_PARTNER_ID)
    .eq("cohort", "treatment")
    .maybeSingle();
  if (sessionError || !session) {
    throw new AssessmentApiError(
      "ASSESSMENT_SESSION_NOT_FOUND",
      "This treatment assessment session could not be found.",
      404,
    );
  }

  const fileBuffer = await file.arrayBuffer();
  const mimeType = inferMimeType(file);
  if (!isFileBufferConsistentWithMimeType(fileBuffer, mimeType)) {
    throw new AssessmentApiError(
      "ASSESSMENT_FILE_UNSUPPORTED",
      "The CV content does not match its file type.",
      415,
    );
  }
  const checksum = sha256(fileBuffer);
  const { data: existing } = await admin
    .from("assessment_documents")
    .select("id, scan_status")
    .eq("assessment_session_id", session.id)
    .eq("kind", "cv")
    .eq("sha256", checksum)
    .maybeSingle();
  if (existing && ["passed", "promoted"].includes(existing.scan_status)) {
    return assessmentJson({ documentId: existing.id, scanStatus: existing.scan_status });
  }

  const documentId = randomUUID();
  const storagePath = `${UC_ASSESSMENT_PARTNER_ID}/${user.id}/${session.id}/${documentId}`;
  const { error: uploadError } = await admin.storage
    .from("assessment-quarantine")
    .upload(storagePath, fileBuffer, { contentType: mimeType, upsert: false });
  if (uploadError) {
    throw new AssessmentApiError(
      "ASSESSMENT_DOCUMENT_UPLOAD_FAILED",
      "The CV could not be stored in quarantine.",
      503,
    );
  }
  const { error: insertError } = await admin.from("assessment_documents").insert({
    assessment_session_id: session.id,
    file_name: file.name || "cv",
    id: documentId,
    kind: "cv",
    mime_type: mimeType,
    owner_user_id: user.id,
    partner_id: UC_ASSESSMENT_PARTNER_ID,
    scan_status: "scanning",
    sha256: checksum,
    size_bytes: file.size,
    storage_bucket: "assessment-quarantine",
    storage_path: storagePath,
  });
  if (insertError) {
    await admin.storage.from("assessment-quarantine").remove([storagePath]);
    throw new AssessmentApiError(
      "ASSESSMENT_DOCUMENT_METADATA_FAILED",
      "The quarantined CV could not be recorded.",
      503,
    );
  }

  let scan;
  try {
    scan = await scanAssessmentDocument(fileBuffer, mimeType);
  } catch (error) {
    await admin
      .from("assessment_documents")
      .update({ scan_status: "quarantined" })
      .eq("id", documentId);
    throw error;
  }
  await admin
    .from("assessment_documents")
    .update({
      rejection_reason: scan.clean ? null : "malware_scan_rejected",
      scan_provider: scan.provider,
      scan_reference: scan.reference,
      scan_status: scan.clean ? "passed" : "rejected",
      scanned_at: new Date().toISOString(),
    })
    .eq("id", documentId);
  if (!scan.clean) {
    throw new AssessmentApiError(
      "ASSESSMENT_DOCUMENT_REJECTED",
      "The CV did not pass security scanning and cannot be used.",
      422,
    );
  }

  await recordAssessmentAudit({
    action: "assessment_document_scanned",
    actorUserId: user.id,
    admin,
    assessmentSessionId: session.id,
    metadata: { kind: "cv", scanStatus: "passed" },
    request,
    targetId: documentId,
    targetType: "assessment_document",
  });
  return assessmentJson({ documentId, scanStatus: "passed" });
}

export default assessmentHandler("/api/assessment/document", handleDocument);
