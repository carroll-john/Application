import type { Json } from "../../src/lib/supabase.types.js";
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

const SESSION_STATUSES = new Set([
  "cv_review",
  "shortlist",
  "transcript",
  "evaluated",
]);

function sessionIdFrom(request: Request, payload?: Record<string, unknown>) {
  return (
    (typeof payload?.sessionId === "string" ? payload.sessionId : "") ||
    new URL(request.url).searchParams.get("id") ||
    ""
  ).trim();
}

async function loadOwnedSession(
  admin: ReturnType<typeof createAssessmentAdminClient>,
  sessionId: string,
  ownerUserId: string,
) {
  const { data, error } = await admin
    .from("assessment_sessions")
    .select("*, assessment_results(*)")
    .eq("id", sessionId)
    .eq("owner_user_id", ownerUserId)
    .eq("partner_id", UC_ASSESSMENT_PARTNER_ID)
    .maybeSingle();

  if (error || !data) {
    throw new AssessmentApiError(
      "ASSESSMENT_SESSION_NOT_FOUND",
      "This assessment session could not be found.",
      404,
    );
  }
  return data;
}

async function handleSession(request: Request) {
  requireAssessmentTreatmentEnabled();
  const { user } = await getAssessmentUser(request);
  const admin = createAssessmentAdminClient();

  if (request.method === "GET") {
    const sessionId = sessionIdFrom(request);
    if (!sessionId) {
      throw new AssessmentApiError(
        "ASSESSMENT_SESSION_ID_REQUIRED",
        "An assessment session ID is required.",
        400,
      );
    }
    const session = await loadOwnedSession(admin, sessionId, user.id);
    await recordAssessmentAudit({
      action: "applicant_session_viewed",
      actorUserId: user.id,
      admin,
      assessmentSessionId: session.id,
      request,
      targetId: session.id,
      targetType: "assessment_session",
    });
    return assessmentJson(session);
  }

  if (request.method !== "PATCH") {
    throw new AssessmentApiError(
      "ASSESSMENT_METHOD_NOT_ALLOWED",
      "Method not allowed.",
      405,
    );
  }

  const payload = await readJsonObject(request);
  const sessionId = sessionIdFrom(request, payload);
  const session = await loadOwnedSession(admin, sessionId, user.id);
  if (session.cohort !== "treatment") {
    throw new AssessmentApiError(
      "ASSESSMENT_TREATMENT_REQUIRED",
      "This invitation uses the standard course journey.",
      403,
    );
  }

  const shortlist = Array.isArray(payload.shortlistCourseCodes)
    ? payload.shortlistCourseCodes.filter(
        (value): value is string => typeof value === "string" && Boolean(value.trim()),
      )
    : undefined;
  if (shortlist && (shortlist.length > 3 || new Set(shortlist).size !== shortlist.length)) {
    throw new AssessmentApiError(
      "ASSESSMENT_SHORTLIST_INVALID",
      "Choose no more than three different courses.",
      400,
    );
  }

  const status = typeof payload.status === "string" ? payload.status : undefined;
  if (status && !SESSION_STATUSES.has(status)) {
    throw new AssessmentApiError(
      "ASSESSMENT_STATUS_INVALID",
      "The assessment stage is invalid.",
      400,
    );
  }

  const confirmedCv =
    payload.confirmedCv && typeof payload.confirmedCv === "object"
      ? (payload.confirmedCv as Json)
      : undefined;
  const { error } = await admin
    .from("assessment_sessions")
    .update({
      ...(confirmedCv !== undefined ? { confirmed_cv: confirmedCv } : {}),
      ...(shortlist !== undefined ? { shortlist_course_codes: shortlist } : {}),
      ...(status ? { status: status as "cv_review" | "shortlist" | "transcript" | "evaluated" } : {}),
    })
    .eq("id", session.id)
    .eq("owner_user_id", user.id);

  if (error) {
    throw new AssessmentApiError(
      "ASSESSMENT_SESSION_SAVE_FAILED",
      "The assessment could not be saved.",
      503,
    );
  }

  await recordAssessmentAudit({
    action: "applicant_session_updated",
    actorUserId: user.id,
    admin,
    assessmentSessionId: session.id,
    metadata: {
      cvConfirmed: confirmedCv !== undefined,
      shortlistCount: shortlist?.length ?? session.shortlist_course_codes.length,
      status: status ?? session.status,
    },
    request,
    targetId: session.id,
    targetType: "assessment_session",
  });

  return assessmentJson(await loadOwnedSession(admin, session.id, user.id));
}

export default assessmentHandler("/api/assessment/session", handleSession);
