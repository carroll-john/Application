import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { getClientIp } from "./_documentParser/auth.js";
import { createRateLimiter } from "./_shared/rateLimiter.js";
// Importing initializes Sentry as a side effect.
import {
  buildSentryContext,
  captureApiException,
  flushSentry,
} from "./_shared/sentry.js";

// Issues a short-lived signed URL for the ElevenLabs enrolment advisor agent.
// The browser never sees ELEVENLABS_API_KEY; the SDK reads it from the
// environment. The advisor chat is pre-application guidance and carries no
// applicant data, so it does not require a session.

const advisorChatRateLimiter = createRateLimiter({ max: 10, windowMs: 60_000 });

let client: ElevenLabsClient | null = null;

function getClient() {
  client ??= new ElevenLabsClient();
  return client;
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
    status,
  });
}

function errorResponse(error: string, code: string, status: number) {
  return jsonResponse({ code, error }, status);
}

export async function handleAdvisorChatSessionRequest(
  request: Request,
  deps: { getSignedUrl?: (agentId: string) => Promise<string> } = {},
) {
  if (request.method !== "POST") {
    return errorResponse("Method not allowed.", "ADVISOR_CHAT_METHOD_NOT_ALLOWED", 405);
  }

  const agentId = process.env.ELEVENLABS_AGENT_ID?.trim();
  if (!agentId || !process.env.ELEVENLABS_API_KEY) {
    return errorResponse(
      "Advisor chat is not configured.",
      "ADVISOR_CHAT_NOT_CONFIGURED",
      503,
    );
  }

  if (advisorChatRateLimiter.isLimited(`ip:${getClientIp(request) ?? "unknown"}`)) {
    return errorResponse(
      "Too many chat requests. Try again in a minute.",
      "ADVISOR_CHAT_RATE_LIMITED",
      429,
    );
  }

  const getSignedUrl =
    deps.getSignedUrl ??
    (async (id: string) => {
      const response = await getClient().conversationalAi.conversations.getSignedUrl({
        agentId: id,
      });
      return response.signedUrl;
    });

  return jsonResponse({ signedUrl: await getSignedUrl(agentId) });
}

async function handleWebRequest(request: Request) {
  try {
    return await handleAdvisorChatSessionRequest(request);
  } catch (error) {
    await captureApiException(error, buildSentryContext(request));
    await flushSentry();
    return errorResponse(
      "Advisor chat is unavailable right now.",
      "ADVISOR_CHAT_UNEXPECTED_ERROR",
      502,
    );
  }
}

export default {
  fetch: handleWebRequest,
};
