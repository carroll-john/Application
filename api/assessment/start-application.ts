import { randomUUID } from "node:crypto";
import { sanitizeDocumentFileName } from "../../src/lib/documentStoragePath.js";
import { UC_ASSESSMENT_PARTNER_ID } from "../../src/lib/assessment/ucGovernance.js";
import { assessmentHandler } from "../_assessment/handler.js";
import {
  AssessmentApiError,
  assessmentJson,
  createAssessmentAdminClient,
  getAssessmentUser,
  readJsonObject,
  recordAssessmentAudit,
  requireAssessmentTreatmentEnabled,
} from "../_assessment/server.js";

async function handleStartApplication(request: Request) {
  if (request.method !== "POST") {
    throw new AssessmentApiError(
      "ASSESSMENT_METHOD_NOT_ALLOWED",
      "Method not allowed.",
      405,
    );
  }
  requireAssessmentTreatmentEnabled();

  const payload = await readJsonObject(request);
  const sessionId =
    typeof payload.assessmentSessionId === "string"
      ? payload.assessmentSessionId.trim()
      : "";
  const applicationId =
    typeof payload.applicationId === "string" ? payload.applicationId.trim() : "";
  if (!sessionId || !applicationId) {
    throw new AssessmentApiError(
      "ASSESSMENT_HANDOFF_INVALID",
      "An assessment session and application are required.",
      400,
    );
  }

  const { client, user } = await getAssessmentUser(request);
  const admin = createAssessmentAdminClient();
  const [{ data: session, error: sessionError }, { data: application, error: appError }] =
    await Promise.all([
      admin
        .from("assessment_sessions")
        .select("*")
        .eq("id", sessionId)
        .eq("owner_user_id", user.id)
        .eq("partner_id", UC_ASSESSMENT_PARTNER_ID)
        .eq("cohort", "treatment")
        .maybeSingle(),
      admin
        .from("applications")
        .select("id, user_id, assessment_session_id")
        .eq("id", applicationId)
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

  if (sessionError || !session || appError || !application) {
    throw new AssessmentApiError(
      "ASSESSMENT_HANDOFF_FORBIDDEN",
      "The assessment could not be linked to this application.",
      403,
    );
  }
  if (session.status !== "evaluated" && session.status !== "application_started") {
    throw new AssessmentApiError(
      "ASSESSMENT_NOT_EVALUATED",
      "Complete the assessment before starting an application.",
      409,
    );
  }
  if (session.application_id && session.application_id !== application.id) {
    throw new AssessmentApiError(
      "ASSESSMENT_ALREADY_PROMOTED",
      "This assessment is already linked to another application.",
      409,
    );
  }
  if (
    application.assessment_session_id &&
    application.assessment_session_id !== session.id
  ) {
    throw new AssessmentApiError(
      "APPLICATION_ASSESSMENT_CONFLICT",
      "This application is already linked to another assessment.",
      409,
    );
  }

  const { data: documents, error: documentsError } = await admin
    .from("assessment_documents")
    .select("*")
    .eq("assessment_session_id", session.id)
    .in("scan_status", ["passed", "promoted"])
    .order("created_at", { ascending: true });
  if (documentsError) {
    throw new AssessmentApiError(
      "ASSESSMENT_DOCUMENTS_UNAVAILABLE",
      "Passed assessment documents could not be loaded.",
      503,
    );
  }

  const promotedDocumentIds: string[] = [];
  for (const document of documents ?? []) {
    if (document.promoted_application_document_id) {
      promotedDocumentIds.push(document.promoted_application_document_id);
      continue;
    }

    const { data: download, error: downloadError } = await admin.storage
      .from(document.storage_bucket)
      .download(document.storage_path);
    if (downloadError || !download) {
      throw new AssessmentApiError(
        "ASSESSMENT_DOCUMENT_PROMOTION_FAILED",
        "A passed assessment document could not be promoted.",
        503,
      );
    }

    const applicationDocumentId = randomUUID();
    const kind = document.kind === "cv" ? "cv" : "tertiary_transcript";
    const destinationPath = `${user.id}/${application.id}/${kind}/${applicationDocumentId}-${sanitizeDocumentFileName(document.file_name)}`;
    const { error: uploadError } = await client.storage
      .from("application-documents")
      .upload(destinationPath, download, {
        contentType: document.mime_type,
        upsert: false,
      });
    if (uploadError) {
      throw new AssessmentApiError(
        "ASSESSMENT_DOCUMENT_PROMOTION_FAILED",
        "A passed assessment document could not be promoted.",
        503,
      );
    }

    const { error: metadataError } = await client.from("application_documents").insert({
      application_id: application.id,
      file_name: document.file_name,
      id: applicationDocumentId,
      kind,
      mime_type: document.mime_type,
      size_bytes: document.size_bytes,
      storage_bucket: "application-documents",
      storage_path: destinationPath,
    });
    if (metadataError) {
      await client.storage.from("application-documents").remove([destinationPath]);
      throw new AssessmentApiError(
        "ASSESSMENT_DOCUMENT_PROMOTION_FAILED",
        "A passed assessment document could not be attached to the application.",
        503,
      );
    }

    if (kind === "cv") {
      await client
        .from("applications")
        .update({ cv_document_id: applicationDocumentId, cv_file_name: document.file_name })
        .eq("id", application.id);
    } else {
      const { data: qualification } = await client
        .from("tertiary_qualifications")
        .select("id")
        .eq("application_id", application.id)
        .not("transcript_eligibility", "is", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (qualification) {
        await client
          .from("tertiary_qualifications")
          .update({
            transcript_document_id: applicationDocumentId,
            transcript_document_name: document.file_name,
          })
          .eq("id", qualification.id);
      }
    }

    await admin
      .from("assessment_documents")
      .update({
        promoted_application_document_id: applicationDocumentId,
        promoted_at: new Date().toISOString(),
        scan_status: "promoted",
      })
      .eq("id", document.id)
      .eq("scan_status", "passed");
    promotedDocumentIds.push(applicationDocumentId);
  }

  const { error: applicationUpdateError } = await admin
    .from("applications")
    .update({
      assessment_model_version: session.model_version,
      assessment_rules_version: session.rules_version,
      assessment_session_id: session.id,
      catalogue_id: session.catalogue_id,
      catalogue_version: session.catalogue_version,
      partner_id: session.partner_id,
    })
    .eq("id", application.id)
    .eq("user_id", user.id);
  const { error: sessionUpdateError } = await admin
    .from("assessment_sessions")
    .update({ application_id: application.id, status: "application_started" })
    .eq("id", session.id)
    .eq("owner_user_id", user.id);
  if (applicationUpdateError || sessionUpdateError) {
    throw new AssessmentApiError(
      "ASSESSMENT_HANDOFF_SAVE_FAILED",
      "The assessment handoff could not be completed.",
      503,
    );
  }

  await recordAssessmentAudit({
    action: "assessment_promoted_to_application",
    actorUserId: user.id,
    admin,
    assessmentSessionId: session.id,
    metadata: { promotedDocumentCount: promotedDocumentIds.length },
    request,
    targetId: application.id,
    targetType: "application",
  });

  return assessmentJson({
    applicationId: application.id,
    assessmentSessionId: session.id,
    promotedDocumentIds,
  });
}

export default assessmentHandler(
  "/api/assessment/start-application",
  handleStartApplication,
);
