import { captureEligibilityFeedback } from "./_shared/posthogAiObservability.js";

const ALLOWED_STATUSES = new Set(["pass", "fail", "unknown"] as const);

type Status = "pass" | "fail" | "unknown";

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
    status,
  });
}

function errorResponse(error: string, code: string, status = 400) {
  return jsonResponse({ code, error }, status);
}

function readString(value: unknown, maxLen = 500): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

function readStatus(value: unknown): Status | undefined {
  return typeof value === "string" && (ALLOWED_STATUSES as Set<string>).has(value)
    ? (value as Status)
    : undefined;
}

async function handleWebRequest(request: Request) {
  if (request.method !== "POST") {
    return errorResponse(
      "Method not allowed.",
      "ELIGIBILITY_FEEDBACK_METHOD_NOT_ALLOWED",
      405,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body.", "ELIGIBILITY_FEEDBACK_INVALID_BODY", 400);
  }

  if (!body || typeof body !== "object") {
    return errorResponse("Invalid JSON body.", "ELIGIBILITY_FEEDBACK_INVALID_BODY", 400);
  }

  const candidate = body as Record<string, unknown>;
  const requirementId = readString(candidate.requirementId, 200);
  const originalStatus = readStatus(candidate.originalStatus);
  const overrideStatus = readStatus(candidate.overrideStatus);

  if (!requirementId || !originalStatus || !overrideStatus) {
    return errorResponse(
      "requirementId, originalStatus, and overrideStatus are required.",
      "ELIGIBILITY_FEEDBACK_REQUIRED_FIELDS_MISSING",
      400,
    );
  }

  // Fire-and-forget: feedback capture must not block the response. Observability errors are
  // swallowed inside `captureEligibilityFeedback`.
  await captureEligibilityFeedback({
    requirementId,
    originalStatus,
    overrideStatus,
    courseCode: readString(candidate.courseCode, 100),
    courseTitle: readString(candidate.courseTitle, 200),
    requirementSourceText: readString(candidate.requirementSourceText, 600),
    reason: readString(candidate.reason, 500),
    rulesVersion: readString(candidate.rulesVersion, 100),
    serviceVersion: readString(candidate.serviceVersion, 100),
  });

  return jsonResponse({ ok: true }, 200);
}

export default {
  fetch: handleWebRequest,
};
