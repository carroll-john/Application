import { hashAnalyticsIdentifierServer } from "./analyticsIdentity.js";
import { getPostHogServerClient } from "./posthogServerClient.js";

const ALLOWED_SIGNUP_METHODS = new Set(["email", "google", "magic_link"]);

export type AuthSignUpSucceededOptions = {
  userId: string;
  signupMethod: string;
  emailDomain?: string;
  authContext?: string;
};

export function isAllowedSignupMethod(value: string) {
  return ALLOWED_SIGNUP_METHODS.has(value);
}

function buildSignUpSucceededInsertId(userId: string) {
  return `auth-sign-up-succeeded:${userId}`;
}

/**
 * Captures `auth_sign_up_succeeded` once per user. PostHog deduplicates on
 * `$insert_id`, so retries or duplicate API calls do not inflate counts.
 */
export async function captureAuthSignUpSucceeded(
  options: AuthSignUpSucceededOptions,
) {
  const client = getPostHogServerClient();
  if (!client) {
    return;
  }

  const distinctId = hashAnalyticsIdentifierServer(options.userId);

  try {
    await client.captureImmediate({
      distinctId,
      event: "auth_sign_up_succeeded",
      properties: {
        signup_method: options.signupMethod,
        email_domain: options.emailDomain ?? null,
        auth_context: options.authContext ?? null,
        $insert_id: buildSignUpSucceededInsertId(options.userId),
      },
    });
  } catch {
    // Observability must never block the calling request.
  }
}
