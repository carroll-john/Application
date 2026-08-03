import { createHash, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { Database } from "../../src/lib/supabase.types.js";
import { UC_ASSESSMENT_PARTNER_ID } from "../../src/lib/assessment/ucGovernance.js";

export type AssessmentServerClient = SupabaseClient<Database>;

export class AssessmentApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "AssessmentApiError";
  }
}

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new AssessmentApiError(
      "ASSESSMENT_NOT_CONFIGURED",
      `The UC assessment pilot is missing ${name}.`,
      503,
    );
  }
  return value;
}

export function getAssessmentEnvironment() {
  const url = requiredEnvironment("SUPABASE_URL");
  const anonKey = requiredEnvironment("SUPABASE_ANON_KEY");
  const serviceRoleKey = requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY");
  const pilotProjectRef = requiredEnvironment("UC_MVP_SUPABASE_PROJECT_REF");
  const urlProjectRef = new URL(url).hostname.split(".")[0] ?? "";
  const forbiddenProjectRef = process.env.UC_DEMO_SUPABASE_PROJECT_REF?.trim();

  if (urlProjectRef !== pilotProjectRef) {
    throw new AssessmentApiError(
      "ASSESSMENT_PROJECT_MISMATCH",
      "The configured Supabase URL does not match the UC MVP project reference.",
      503,
    );
  }
  if (forbiddenProjectRef && pilotProjectRef === forbiddenProjectRef) {
    throw new AssessmentApiError(
      "ASSESSMENT_DEMO_DEPENDENCY_BLOCKED",
      "The UC MVP cannot use the frozen demo Supabase project.",
      503,
    );
  }

  return { anonKey, pilotProjectRef, serviceRoleKey, url };
}

export function createAssessmentAdminClient() {
  const { serviceRoleKey, url } = getAssessmentEnvironment();
  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

export function requireAssessmentTreatmentEnabled() {
  if (
    process.env.UC_ASSESSMENT_TREATMENT_ENABLED?.trim().toLowerCase() !== "true"
  ) {
    throw new AssessmentApiError(
      "ASSESSMENT_TREATMENT_DISABLED",
      "The assessment journey is unavailable. Continue with the standard UC application journey.",
      503,
    );
  }
}

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  return authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim() || null
    : null;
}

export async function getAssessmentUser(
  request: Request,
  options: { requireAal2?: boolean } = {},
) {
  const token = bearerToken(request);
  if (!token) {
    throw new AssessmentApiError(
      "ASSESSMENT_UNAUTHENTICATED",
      "Sign in to continue this assessment.",
      401,
    );
  }

  const { anonKey, url } = getAssessmentEnvironment();
  const client = createClient<Database>(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.auth.getUser(token);

  if (error || !data.user) {
    throw new AssessmentApiError(
      "ASSESSMENT_UNAUTHENTICATED",
      "Your session expired. Sign in again to continue.",
      401,
    );
  }

  if (options.requireAal2) {
    const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance.error || assurance.data.currentLevel !== "aal2") {
      throw new AssessmentApiError(
        "ASSESSMENT_AAL2_REQUIRED",
        "Verify your authenticator code before opening staff reviews.",
        403,
      );
    }
  }

  return { client, token, user: data.user };
}

export function sha256(value: string | ArrayBuffer) {
  const hash = createHash("sha256");
  hash.update(typeof value === "string" ? value : Buffer.from(value));
  return hash.digest("hex");
}

export async function requireRateLimit(options: {
  admin: AssessmentServerClient;
  key: string;
  max: number;
  windowSeconds: number;
}) {
  const { data, error } = await options.admin.rpc("consume_assessment_rate_limit", {
    target_key_hash: sha256(options.key),
    target_max: options.max,
    target_window_seconds: options.windowSeconds,
  });

  if (error) {
    throw new AssessmentApiError(
      "ASSESSMENT_RATE_LIMIT_UNAVAILABLE",
      "The assessment cannot be started safely right now. Try again shortly.",
      503,
    );
  }
  if (!data) {
    throw new AssessmentApiError(
      "ASSESSMENT_RATE_LIMITED",
      "Too many assessment requests. Wait a moment and try again.",
      429,
    );
  }
}

export async function requireTreatmentInvitation(request: Request) {
  requireAssessmentTreatmentEnabled();
  const token = request.headers.get("x-uc-pilot-invitation")?.trim() ?? "";
  if (token.length < 24 || token.length > 512) {
    throw new AssessmentApiError(
      "ASSESSMENT_INVITATION_REQUIRED",
      "Use your UC pilot invitation link to start this assessment.",
      403,
    );
  }

  const admin = createAssessmentAdminClient();
  const { data: participant, error } = await admin
    .from("pilot_participants")
    .select("id, cohort, expires_at, disabled_at")
    .eq("partner_id", UC_ASSESSMENT_PARTNER_ID)
    .eq("invitation_token_hash", sha256(token))
    .maybeSingle();
  if (
    error ||
    !participant ||
    participant.cohort !== "treatment" ||
    participant.disabled_at ||
    new Date(participant.expires_at).getTime() <= Date.now()
  ) {
    throw new AssessmentApiError(
      "ASSESSMENT_INVITATION_REQUIRED",
      "This UC pilot invitation is invalid, expired, or assigned to the standard journey.",
      403,
    );
  }

  await requireRateLimit({
    admin,
    key: `anonymous-cv:${participant.id}`,
    max: 5,
    windowSeconds: 60,
  });
  return participant;
}

export async function requireStaffRole(options: {
  admin: AssessmentServerClient;
  partnerId?: string;
  user: User;
}) {
  const partnerId = options.partnerId ?? UC_ASSESSMENT_PARTNER_ID;
  const { data, error } = await options.admin
    .from("staff_roles")
    .select("id, partner_id, role, expires_at")
    .eq("partner_id", partnerId)
    .eq("user_id", options.user.id)
    .eq("active", true)
    .maybeSingle();

  if (
    error ||
    !data ||
    (data.expires_at && new Date(data.expires_at).getTime() <= Date.now())
  ) {
    throw new AssessmentApiError(
      "ASSESSMENT_STAFF_FORBIDDEN",
      "This account does not have an active role for this UC pilot.",
      403,
    );
  }

  return data;
}

export async function recordAssessmentAudit(options: {
  action: string;
  admin: AssessmentServerClient;
  actorUserId?: string | null;
  assessmentSessionId?: string | null;
  metadata?: Record<string, boolean | number | string | null>;
  partnerId?: string;
  request: Request;
  targetId?: string | null;
  targetType: string;
}) {
  const requestId =
    options.request.headers.get("x-request-id")?.trim() || randomUUID();
  const forwardedFor = options.request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const userAgent = options.request.headers.get("user-agent")?.trim();
  const { error } = await options.admin.from("assessment_audit_events").insert({
    action: options.action,
    actor_user_id: options.actorUserId ?? null,
    assessment_session_id: options.assessmentSessionId ?? null,
    ip_hash: forwardedFor ? sha256(forwardedFor) : null,
    metadata: options.metadata ?? {},
    partner_id: options.partnerId ?? UC_ASSESSMENT_PARTNER_ID,
    request_id: requestId,
    target_id: options.targetId ?? null,
    target_type: options.targetType,
    user_agent_hash: userAgent ? sha256(userAgent) : null,
  });

  if (error) {
    throw new AssessmentApiError(
      "ASSESSMENT_AUDIT_FAILED",
      "The requested action was not completed because it could not be audited.",
      503,
    );
  }
}

export function assessmentJson(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    headers: {
      "cache-control": "no-store, private",
      "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
    status,
  });
}

export function assessmentError(error: unknown) {
  if (error instanceof AssessmentApiError) {
    return assessmentJson({ code: error.code, error: error.message }, error.status);
  }

  console.error("Unexpected assessment API failure", error);
  return assessmentJson(
    { code: "ASSESSMENT_UNEXPECTED_ERROR", error: "The assessment request failed." },
    500,
  );
}

export async function readJsonObject(request: Request) {
  try {
    const value = (await request.json()) as unknown;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  } catch {
    // Normalized to the same safe validation error below.
  }

  throw new AssessmentApiError(
    "ASSESSMENT_INVALID_REQUEST",
    "The assessment request body is invalid.",
    400,
  );
}
