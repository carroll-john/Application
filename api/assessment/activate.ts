import { randomUUID } from "node:crypto";
import {
  UC_ASSESSMENT_CATALOGUE_VERSION,
  UC_ASSESSMENT_MODEL_VERSION,
  UC_ASSESSMENT_PARTNER_ID,
  UC_ASSESSMENT_RULES_VERSION,
} from "../../src/lib/assessment/ucGovernance.js";
import { assessmentHandler } from "../_assessment/handler.js";
import {
  AssessmentApiError,
  assessmentJson,
  createAssessmentAdminClient,
  getAssessmentUser,
  readJsonObject,
  recordAssessmentAudit,
  requireRateLimit,
  sha256,
} from "../_assessment/server.js";

function allocatedCohort(participantId: string) {
  return Number.parseInt(sha256(participantId).slice(0, 2), 16) % 2 === 0
    ? ("control" as const)
    : ("treatment" as const);
}

async function handleActivation(request: Request) {
  if (request.method !== "POST") {
    throw new AssessmentApiError(
      "ASSESSMENT_METHOD_NOT_ALLOWED",
      "Method not allowed.",
      405,
    );
  }

  const payload = await readJsonObject(request);
  const invitationToken =
    typeof payload.invitationToken === "string" ? payload.invitationToken.trim() : "";
  if (invitationToken.length < 24 || invitationToken.length > 512) {
    throw new AssessmentApiError(
      "ASSESSMENT_INVITATION_INVALID",
      "This pilot invitation is invalid or expired.",
      404,
    );
  }

  const admin = createAssessmentAdminClient();
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  await requireRateLimit({
    admin,
    key: `activation:${clientIp ?? "unknown"}`,
    max: 12,
    windowSeconds: 60,
  });

  const { data: participant, error } = await admin
    .from("pilot_participants")
    .select("id, partner_id, invited_user_id, cohort, expires_at, disabled_at")
    .eq("invitation_token_hash", sha256(invitationToken))
    .maybeSingle();

  if (
    error ||
    !participant ||
    participant.disabled_at ||
    participant.partner_id !== UC_ASSESSMENT_PARTNER_ID ||
    new Date(participant.expires_at).getTime() <= Date.now()
  ) {
    throw new AssessmentApiError(
      "ASSESSMENT_INVITATION_INVALID",
      "This pilot invitation is invalid or expired.",
      404,
    );
  }

  const cohort = participant.cohort ?? allocatedCohort(participant.id);
  const treatmentEnabled =
    process.env.UC_ASSESSMENT_TREATMENT_ENABLED?.trim().toLowerCase() === "true";
  const effectiveCohort =
    cohort === "treatment" && !treatmentEnabled ? ("control" as const) : cohort;
  if (!participant.cohort) {
    const { error: allocationError } = await admin
      .from("pilot_participants")
      .update({ activated_at: new Date().toISOString(), cohort })
      .eq("id", participant.id)
      .is("cohort", null);
    if (allocationError) {
      throw new AssessmentApiError(
        "ASSESSMENT_ACTIVATION_FAILED",
        "The invitation could not be activated.",
        503,
      );
    }
  } else {
    await admin
      .from("pilot_participants")
      .update({ activated_at: new Date().toISOString() })
      .eq("id", participant.id)
      .is("activated_at", null);
  }

  let sessionId: string | null = null;
  let resumed = false;
  const hasAuthorization = Boolean(request.headers.get("authorization"));
  if (hasAuthorization) {
    const { user } = await getAssessmentUser(request);
    if (!participant.invited_user_id || participant.invited_user_id !== user.id) {
      throw new AssessmentApiError(
        "ASSESSMENT_INVITATION_ACCOUNT_MISMATCH",
        "Sign in with the account associated with this pilot invitation.",
        403,
      );
    }

    if (effectiveCohort === "treatment") {
      const { data: existing, error: existingError } = await admin
        .from("assessment_sessions")
        .select("id")
        .eq("participant_id", participant.id)
        .maybeSingle();
      if (existingError) {
        throw new AssessmentApiError(
          "ASSESSMENT_SESSION_FAILED",
          "The assessment session could not be resumed.",
          503,
        );
      }

      if (existing) {
        sessionId = existing.id;
        resumed = true;
      } else {
        const newSessionId = randomUUID();
        const { error: createError } = await admin.from("assessment_sessions").insert({
          catalogue_id: "uc",
          catalogue_version: UC_ASSESSMENT_CATALOGUE_VERSION,
          cohort,
          id: newSessionId,
          model_version: UC_ASSESSMENT_MODEL_VERSION,
          owner_user_id: user.id,
          participant_id: participant.id,
          partner_id: UC_ASSESSMENT_PARTNER_ID,
          rules_version: UC_ASSESSMENT_RULES_VERSION,
          status: "cv_review",
        });
        if (createError) {
          throw new AssessmentApiError(
            "ASSESSMENT_SESSION_FAILED",
            "The assessment session could not be created.",
            503,
          );
        }
        sessionId = newSessionId;
      }
    }

    await recordAssessmentAudit({
      action: "invitation_activated",
      actorUserId: user.id,
      admin,
      assessmentSessionId: sessionId,
      metadata: { cohort: effectiveCohort, treatmentEnabled },
      request,
      targetId: participant.id,
      targetType: "pilot_participant",
    });
  }

  return assessmentJson({
    cohort: effectiveCohort,
    participantId: participant.id,
    partnerId: participant.partner_id,
    resumed,
    sessionId,
  });
}

export default assessmentHandler("/api/assessment/activate", handleActivation);
