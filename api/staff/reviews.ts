import { assessmentHandler } from "../_assessment/handler.js";
import { getAssessmentStaffContext } from "../_assessment/staff.js";
import {
  AssessmentApiError,
  assessmentJson,
  recordAssessmentAudit,
} from "../_assessment/server.js";

const REVIEW_STATUSES = new Set([
  "unassigned",
  "in_review",
  "agreed",
  "corrected",
  "exported",
]);

function decodeCursor(value: string | undefined) {
  if (!value) return null;
  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
      createdAt?: unknown;
      id?: unknown;
    };
    if (
      typeof decoded.createdAt !== "string" ||
      Number.isNaN(Date.parse(decoded.createdAt)) ||
      typeof decoded.id !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(decoded.id)
    ) {
      return null;
    }
    return { createdAt: decoded.createdAt, id: decoded.id };
  } catch {
    return null;
  }
}

function encodeCursor(review: { created_at: string; id: string }) {
  return Buffer.from(
    JSON.stringify({ createdAt: review.created_at, id: review.id }),
  ).toString("base64url");
}

async function handleReviews(request: Request) {
  if (request.method !== "GET") {
    throw new AssessmentApiError(
      "ASSESSMENT_METHOD_NOT_ALLOWED",
      "Method not allowed.",
      405,
    );
  }
  const { admin, partnerId, user } = await getAssessmentStaffContext(request);
  const url = new URL(request.url);
  const status = url.searchParams.get("status")?.trim();
  if (status && !REVIEW_STATUSES.has(status)) {
    throw new AssessmentApiError(
      "ASSESSMENT_REVIEW_FILTER_INVALID",
      "The requested review status is not valid.",
      400,
    );
  }
  const rawCursor = url.searchParams.get("cursor")?.trim();
  const cursor = decodeCursor(rawCursor);
  if (rawCursor && !cursor) {
    throw new AssessmentApiError(
      "ASSESSMENT_REVIEW_CURSOR_INVALID",
      "The review queue cursor is not valid.",
      400,
    );
  }
  let query = admin
    .from("assessment_reviews")
    .select(
      "id, partner_id, assessment_session_id, status, assigned_to, correction_category, corrected_credit_points, claimed_at, reviewed_at, exported_at, created_at",
    )
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(25);

  if (status) {
    query = query.eq(
      "status",
      status as "unassigned" | "in_review" | "agreed" | "corrected" | "exported",
    );
  }
  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    );
  }
  const { data: reviews, error } = await query;
  if (error) {
    throw new AssessmentApiError(
      "ASSESSMENT_REVIEW_LIST_FAILED",
      "The review queue could not be loaded.",
      503,
    );
  }

  const sessionIds = (reviews ?? []).map((review) => review.assessment_session_id);
  const [{ data: sessions }, { data: results }] = await Promise.all([
    sessionIds.length
      ? admin
          .from("assessment_sessions")
          .select(
            "id, application_id, status, catalogue_version, rules_version, model_version, created_at",
          )
          .in("id", sessionIds)
      : Promise.resolve({ data: [], error: null }),
    sessionIds.length
      ? admin
          .from("assessment_results")
          .select(
            "assessment_session_id, course_code, potential_credit_points, published_cap, confidence, manual_review_reasons",
          )
          .in("assessment_session_id", sessionIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  await recordAssessmentAudit({
    action: "staff_queue_viewed",
    actorUserId: user.id,
    admin,
    metadata: { resultCount: reviews?.length ?? 0 },
    request,
    targetType: "assessment_review_queue",
  });

  return assessmentJson({
    nextCursor:
      reviews && reviews.length === 25 && reviews[reviews.length - 1]
        ? encodeCursor(reviews[reviews.length - 1])
        : null,
    reviews: (reviews ?? []).map((review) => ({
      ...review,
      results: (results ?? []).filter(
        (result) => result.assessment_session_id === review.assessment_session_id,
      ),
      session:
        (sessions ?? []).find(
          (session) => session.id === review.assessment_session_id,
        ) ?? null,
    })),
  });
}

export default assessmentHandler("/api/staff/reviews", handleReviews);
