import {
  captureAuthSignUpSucceeded,
  isAllowedSignupMethod,
} from "./_shared/authSignUpAnalytics.js";
import { createRateLimiter } from "./_shared/rateLimiter.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// One sign-up makes at most one call; this only blunts scripted abuse.
const rateLimiter = createRateLimiter({ max: 30, windowMs: 60_000 });

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

function readString(value: unknown, maxLen = 200): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

function clientKey(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

async function handleWebRequest(request: Request) {
  if (request.method !== "POST") {
    return errorResponse(
      "Method not allowed.",
      "AUTH_SIGN_UP_SUCCEEDED_METHOD_NOT_ALLOWED",
      405,
    );
  }

  if (rateLimiter.isLimited(clientKey(request))) {
    return errorResponse("Too many requests.", "AUTH_SIGN_UP_SUCCEEDED_RATE_LIMITED", 429);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body.", "AUTH_SIGN_UP_SUCCEEDED_INVALID_BODY", 400);
  }

  if (!body || typeof body !== "object") {
    return errorResponse("Invalid JSON body.", "AUTH_SIGN_UP_SUCCEEDED_INVALID_BODY", 400);
  }

  const candidate = body as Record<string, unknown>;
  const userId = readString(candidate.userId, 64);
  const signupMethod = readString(candidate.signupMethod, 32);

  if (!userId || !UUID_PATTERN.test(userId)) {
    return errorResponse("userId must be a valid UUID.", "AUTH_SIGN_UP_SUCCEEDED_INVALID_USER_ID", 400);
  }

  if (!signupMethod || !isAllowedSignupMethod(signupMethod)) {
    return errorResponse(
      "signupMethod must be one of: email, google, magic_link.",
      "AUTH_SIGN_UP_SUCCEEDED_INVALID_SIGNUP_METHOD",
      400,
    );
  }

  // Await the bounded capture call so serverless runtimes do not freeze the
  // request before PostHog receives the event. Failures are swallowed inside
  // captureAuthSignUpSucceeded, so analytics still never blocks sign-up UX.
  await captureAuthSignUpSucceeded({
    userId,
    signupMethod,
    emailDomain: readString(candidate.emailDomain, 200),
    authContext: readString(candidate.authContext, 32),
  });

  return jsonResponse({ ok: true }, 200);
}

export default {
  fetch: handleWebRequest,
};
