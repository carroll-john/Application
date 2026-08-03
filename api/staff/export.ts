import { strToU8, zipSync } from "fflate";
import { assessmentHandler } from "../_assessment/handler.js";
import { getAssessmentStaffContext } from "../_assessment/staff.js";
import {
  AssessmentApiError,
  recordAssessmentAudit,
} from "../_assessment/server.js";

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
}

async function handleExport(request: Request) {
  if (request.method !== "POST") {
    throw new AssessmentApiError(
      "ASSESSMENT_METHOD_NOT_ALLOWED",
      "Method not allowed.",
      405,
    );
  }
  const { admin, partnerId, user } = await getAssessmentStaffContext(request);
  const reviewId = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  const { data: review, error: reviewError } = await admin
    .from("assessment_reviews")
    .select("*")
    .eq("id", reviewId)
    .eq("partner_id", partnerId)
    .maybeSingle();
  if (
    reviewError ||
    !review ||
    !["agreed", "corrected", "exported"].includes(review.status)
  ) {
    throw new AssessmentApiError(
      "ASSESSMENT_EXPORT_NOT_READY",
      "Complete the staff review before exporting this case.",
      409,
    );
  }

  const [{ data: session }, { data: results }, { data: documents }] =
    await Promise.all([
      admin
        .from("assessment_sessions")
        .select("*")
        .eq("id", review.assessment_session_id)
        .eq("partner_id", partnerId)
        .single(),
      admin
        .from("assessment_results")
        .select("*")
        .eq("assessment_session_id", review.assessment_session_id)
        .eq("partner_id", partnerId),
      admin
        .from("assessment_documents")
        .select("*")
        .eq("assessment_session_id", review.assessment_session_id)
        .eq("partner_id", partnerId)
        .in("scan_status", ["passed", "promoted"]),
    ]);
  if (!session?.application_id) {
    throw new AssessmentApiError(
      "ASSESSMENT_APPLICATION_REQUIRED",
      "An application must exist before this case can be exported.",
      409,
    );
  }

  const archive: Record<string, Uint8Array> = {
    "case-manifest.json": strToU8(
      JSON.stringify(
        {
          applicationId: session.application_id,
          assessmentSessionId: session.id,
          catalogueVersion: session.catalogue_version,
          exportedAt: new Date().toISOString(),
          modelVersion: session.model_version,
          partnerId,
          rulesVersion: session.rules_version,
        },
        null,
        2,
      ),
    ),
    "assessment.json": strToU8(JSON.stringify(results ?? [], null, 2)),
    "review.json": strToU8(
      JSON.stringify(
        {
          correctedCreditPoints: review.corrected_credit_points,
          correctionCategory: review.correction_category,
          notes: review.private_notes,
          reviewedAt: review.reviewed_at,
          status: review.status,
        },
        null,
        2,
      ),
    ),
  };

  for (const document of documents ?? []) {
    const { data, error } = await admin.storage
      .from(document.storage_bucket)
      .download(document.storage_path);
    if (error || !data) {
      throw new AssessmentApiError(
        "ASSESSMENT_EXPORT_DOCUMENT_FAILED",
        "A passed document could not be included in the export.",
        503,
      );
    }
    await recordAssessmentAudit({
      action: "staff_document_accessed",
      actorUserId: user.id,
      admin,
      assessmentSessionId: review.assessment_session_id,
      metadata: { purpose: "case_export" },
      request,
      targetId: document.id,
      targetType: "assessment_document",
    });
    archive[
      `documents/${document.kind}-${document.id}-${safeFileName(document.file_name)}`
    ] = new Uint8Array(await data.arrayBuffer());
  }

  await recordAssessmentAudit({
    action: "staff_case_exported",
    actorUserId: user.id,
    admin,
    assessmentSessionId: review.assessment_session_id,
    metadata: { documentCount: documents?.length ?? 0 },
    request,
    targetId: review.id,
    targetType: "assessment_review",
  });
  await admin
    .from("assessment_reviews")
    .update({ exported_at: new Date().toISOString(), status: "exported" })
    .eq("id", review.id)
    .eq("partner_id", partnerId);

  const zip = zipSync(archive, { level: 6 });
  const body = zip.buffer.slice(
    zip.byteOffset,
    zip.byteOffset + zip.byteLength,
  ) as ArrayBuffer;

  return new Response(body, {
    headers: {
      "cache-control": "no-store, private",
      "content-disposition": `attachment; filename="uc-assessment-${review.id}.zip"`,
      "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
      "content-type": "application/zip",
      "x-content-type-options": "nosniff",
    },
  });
}

export default assessmentHandler("/api/staff/export", handleExport);
