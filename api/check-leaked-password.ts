import { createRateLimiter } from "./_shared/rateLimiter.js";

// DIS-119: free-tier-equivalent of Supabase's hosted "leaked password
// protection". Supabase's native HaveIBeenPwned check is a Pro-plan-only Auth
// setting, so we reproduce the same protection in our own code. The browser
// computes the SHA-1 of the candidate password locally and sends only the
// first five hex characters of that hash (k-anonymity); this proxy forwards
// that prefix to the Pwned Passwords range API and streams the response back.
// The full password — and its full hash — never leave the browser, and this
// server never sees either. The proxy exists only because the app's
// Content-Security-Policy `connect-src` does not allow the browser to call
// api.pwnedpasswords.com directly.

const PWNED_RANGE_ENDPOINT = "https://api.pwnedpasswords.com/range/";
const HASH_PREFIX_PATTERN = /^[0-9A-F]{5}$/;
const UPSTREAM_TIMEOUT_MS = 5000;

// Per-warm-instance limiter. A single sign-up or password change makes exactly
// one call, so this generous ceiling only blunts scripted abuse of the open
// proxy rather than affecting real users.
const rateLimiter = createRateLimiter({ max: 60, windowMs: 60_000 });

function textResponse(body: string, status = 200, cacheControl = "no-store") {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": cacheControl,
    },
  });
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
  if (request.method !== "GET") {
    return textResponse("Method not allowed.", 405);
  }

  const prefix = (
    new URL(request.url).searchParams.get("prefix") ?? ""
  ).toUpperCase();

  if (!HASH_PREFIX_PATTERN.test(prefix)) {
    return textResponse("Invalid hash prefix.", 400);
  }

  if (rateLimiter.isLimited(clientKey(request))) {
    return textResponse("Too many requests.", 429);
  }

  let upstream: Response;

  try {
    upstream = await fetch(`${PWNED_RANGE_ENDPOINT}${prefix}`, {
      method: "GET",
      headers: {
        // Pads the response with random entries so the requested prefix's true
        // result count is hidden from anyone observing upstream traffic.
        "Add-Padding": "true",
        accept: "text/plain",
        "user-agent": "application-prototype-leaked-password-check",
      },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    // The client fails open on any non-200, so this just means "no check ran".
    return textResponse("Upstream unavailable.", 502);
  }

  if (!upstream.ok) {
    return textResponse("Upstream error.", 502);
  }

  const body = await upstream.text();

  // The range result for a prefix is stable and the prefix reveals nothing
  // about the password, so a short private cache is safe.
  return textResponse(body, 200, "private, max-age=60");
}

export default {
  fetch: handleWebRequest,
};
