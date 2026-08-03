import { assessmentHandler } from "../_assessment/handler.js";
import { getAssessmentStaffContext } from "../_assessment/staff.js";
import {
  AssessmentApiError,
  assessmentJson,
  readJsonObject,
  recordAssessmentAudit,
} from "../_assessment/server.js";

const CORRECTION_CATEGORIES = new Set([
  "evidence_mapping",
  "credit_band",
  "confidence",
  "manual_review",
  "other",
]);

function reviewId(request: Request, payload?: Record<string, unknown>) {
  return (
    (typeof payload?.reviewId === "string" ? payload.reviewId : "") ||
    new URL(request.url).searchParams.get("id") ||
    ""
  ).trim();
}

async function loadReview(
  admin: Awaited<ReturnType<typeof getAssessmentStaffContext>>["admin"],
  partnerId: string,
  id: string,
) {
  const { data: review, error } = await admin
    .from("assessment_reviews")
    .select("*")
    .eq("id", id)
    .eq("partner_id", partnerId)
    .maybeSingle();
  if (error || !review) {
    throw new AssessmentApiError(
      "ASSESSMENT_REVIEW_NOT_FOUND",
      "This review case could not be found.",
      404,
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
        .select("id, kind, file_name, mime_type, size_bytes, scan_status, scanned_at")
        .eq("assessment_session_id", review.assessment_session_id)
        .eq("partner_id", partnerId)
        .in("scan_status", ["passed", "promoted"]),
    ]);
  return { documents: documents ?? [], results: results ?? [], review, session };
}

async function handleReview(request: Request) {
  const { admin, partnerId, user } = await getAssessmentStaffContext(request);

  if (request.method === "GET") {
    const id = reviewId(request);
    const detail = await loadReview(admin, partnerId, id);
    await recordAssessmentAudit({
      action: "staff_case_viewed",
      actorUserId: user.id,
      admin,
      assessmentSessionId: detail.review.assessment_session_id,
      request,
      targetId: detail.review.id,
      targetType: "assessment_review",
    });
    return assessmentJson(detail);
  }

  if (request.method !== "PATCH") {
    throw new AssessmentApiError(
      "ASSESSMENT_METHOD_NOT_ALLOWED",
      "Method not allowed.",
      405,
    );
  }

  const payload = await readJsonObject(request);
  const id = reviewId(request, payload);
  const detail = await loadReview(admin, partnerId, id);
  const action = typeof payload.action === "string" ? payload.action : "";
  const now = new Date().toISOString();
  let update:
    | {
        assigned_to?: string;
        claimed_at?: string;
        corrected_credit_points?: number | null;
        correction_category?: string | null;
        private_notes?: string | null;
        reviewed_at?: string;
        status: "in_review" | "agreed" | "corrected";
      }
    | undefined;

  if (action === "claim" && detail.review.status === "unassigned") {
    update = {
      assigned_to: user.id,
      claimed_at: now,
      status: "in_review",
    };
  } else if (
    action === "agree" &&
    detail.review.status === "in_review" &&
    detail.review.assigned_to === user.id
  ) {
    update = {
      private_notes:
        typeof payload.privateNotes === "string"
          ? payload.privateNotes.trim().slice(0, 10_000) || null
          : null,
      reviewed_at: now,
      status: "agreed",
    };
  } else if (
    action === "correct" &&
    detail.review.status === "in_review" &&
    detail.review.assigned_to === user.id
  ) {
    const category =
      typeof payload.correctionCategory === "string"
        ? payload.correctionCategory
        : "";
    const corrected = payload.correctedCreditPoints;
    if (
      !CORRECTION_CATEGORIES.has(category) ||
      (corrected !== null &&
        (typeof corrected !== "number" || corrected < 0 || !Number.isInteger(corrected)))
    ) {
      throw new AssessmentApiError(
        "ASSESSMENT_CORRECTION_INVALID",
        "Choose a correction category and a valid credit-point value or manual review.",
        400,
      );
    }
    const publishedCap = Math.max(
      0,
      ...detail.results.map((result) => result.published_cap ?? 0),
    );
    if (typeof corrected === "number" && corrected > publishedCap) {
      throw new AssessmentApiError(
        "ASSESSMENT_CORRECTION_ABOVE_CAP",
        "A reviewer correction cannot exceed the published course cap.",
        400,
      );
    }
    update = {
      corrected_credit_points: corrected as number | null,
      correction_category: category,
      private_notes:
        typeof payload.privateNotes === "string"
          ? payload.privateNotes.trim().slice(0, 10_000) || null
          : null,
      reviewed_at: now,
      status: "corrected",
    };
  }

  if (!update) {
    throw new AssessmentApiError(
      "ASSESSMENT_REVIEW_TRANSITION_INVALID",
      "That review action is not allowed from the current state.",
      409,
    );
  }

  let updateQuery = admin
    .from("assessment_reviews")
    .update(update)
    .eq("id", detail.review.id)
    .eq("partner_id", partnerId)
    .eq("status", detail.review.status);
  if (detail.review.assigned_to) {
    updateQuery = updateQuery.eq("assigned_to", detail.review.assigned_to);
  }
  const { data: updated, error } = await updateQuery.select("*").maybeSingle();
  if (error || !updated) {
    throw new AssessmentApiError(
      "ASSESSMENT_REVIEW_CONFLICT",
      "Another reviewer changed this case. Refresh before trying again.",
      409,
    );
  }

  await recordAssessmentAudit({
    action: `staff_review_${action}`,
    actorUserId: user.id,
    admin,
    assessmentSessionId: detail.review.assessment_session_id,
    metadata: {
      correctionCategory:
        action === "correct" ? update.correction_category ?? null : null,
    },
    request,
    targetId: detail.review.id,
    targetType: "assessment_review",
  });

  return assessmentJson(updated);
}

export default assessmentHandler("/api/staff/review", handleReview);
