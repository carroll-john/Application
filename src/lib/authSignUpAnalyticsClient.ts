export type AuthSignUpSucceededPayload = {
  userId: string;
  signupMethod: "email" | "google" | "magic_link";
  emailDomain?: string;
  authContext?: string;
};

/**
 * Reports a successful sign-up to the server-side PostHog capture route.
 * Failures are non-fatal so sign-up UX is never blocked by analytics.
 */
export async function reportAuthSignUpSucceeded(
  payload: AuthSignUpSucceededPayload,
): Promise<{ ok: boolean }> {
  try {
    const response = await fetch("/api/capture-auth-sign-up-succeeded", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    return { ok: response.ok };
  } catch {
    return { ok: false };
  }
}
