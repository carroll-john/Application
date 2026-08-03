import { assessmentHandler } from "../_assessment/handler.js";
import {
  AssessmentApiError,
  assessmentJson,
  createAssessmentAdminClient,
  recordAssessmentAudit,
} from "../_assessment/server.js";

async function handleRetention(request: Request) {
  if (request.method !== "GET") {
    throw new AssessmentApiError(
      "ASSESSMENT_METHOD_NOT_ALLOWED",
      "Method not allowed.",
      405,
    );
  }
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (
    !cronSecret ||
    request.headers.get("authorization") !== `Bearer ${cronSecret}`
  ) {
    throw new AssessmentApiError(
      "ASSESSMENT_CRON_UNAUTHORIZED",
      "Retention access denied.",
      401,
    );
  }

  const admin = createAssessmentAdminClient();
  const { data: sessions, error } = await admin
    .from("assessment_sessions")
    .select("id, partner_id")
    .lt("expires_at", new Date().toISOString())
    .is("application_id", null)
    .neq("status", "application_started")
    .limit(100);
  if (error) {
    throw new AssessmentApiError(
      "ASSESSMENT_RETENTION_QUERY_FAILED",
      "Expired assessments could not be loaded.",
      503,
    );
  }

  let deletedDocuments = 0;
  for (const session of sessions ?? []) {
    const { data: documents, error: documentError } = await admin
      .from("assessment_documents")
      .select("id, storage_bucket, storage_path")
      .eq("assessment_session_id", session.id)
      .neq("scan_status", "promoted");
    if (documentError) {
      throw new AssessmentApiError(
        "ASSESSMENT_RETENTION_QUERY_FAILED",
        "Expired assessment documents could not be loaded.",
        503,
      );
    }

    const byBucket = new Map<string, string[]>();
    for (const document of documents ?? []) {
      byBucket.set(document.storage_bucket, [
        ...(byBucket.get(document.storage_bucket) ?? []),
        document.storage_path,
      ]);
    }
    for (const [bucket, paths] of byBucket) {
      const { error: removeError } = await admin.storage.from(bucket).remove(paths);
      if (removeError) {
        throw new AssessmentApiError(
          "ASSESSMENT_RETENTION_STORAGE_FAILED",
          "Expired assessment files could not be deleted.",
          503,
        );
      }
      deletedDocuments += paths.length;
    }

    await recordAssessmentAudit({
      action: "assessment_retention_deleted",
      admin,
      assessmentSessionId: session.id,
      metadata: { documentCount: documents?.length ?? 0 },
      partnerId: session.partner_id,
      request,
      targetId: session.id,
      targetType: "assessment_session",
    });
    const { error: deleteError } = await admin
      .from("assessment_sessions")
      .delete()
      .eq("id", session.id)
      .is("application_id", null);
    if (deleteError) {
      throw new AssessmentApiError(
        "ASSESSMENT_RETENTION_DELETE_FAILED",
        "An expired assessment session could not be deleted.",
        503,
      );
    }
  }

  return assessmentJson({
    deletedDocuments,
    deletedSessions: sessions?.length ?? 0,
  });
}

export default assessmentHandler(
  "/api/cron/assessment-retention",
  handleRetention,
);
