import { isSyntheticTestSession } from "./posthog";

export type AuthSignUpSucceededPayload = {
  userId: string;
  signupMethod: "email" | "google" | "magic_link";
  emailDomain?: string;
  authContext?: string;
};

/**
 * Reports a successful sign-up to the server-side PostHog capture route.
 * Failures are non-fatal so sign-up UX is never blocked by analytics.
 *
 * The server capture bypasses the client bot filter and its synthetic_test
 * super-property, so authorised QA sessions must forward the flag themselves —
 * otherwise QA-bot sign-ups count as real ones in the "Sign ups" metric.
 */
export async function reportAuthSignUpSucceeded(
  payload: AuthSignUpSucceededPayload,
): Promise<{ ok: boolean }> {
  try {
    const response = await fetch("/api/capture-auth-sign-up-succeeded", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...payload,
        ...(isSyntheticTestSession() ? { syntheticTest: true } : {}),
      }),
    });
    return { ok: response.ok };
  } catch {
    return { ok: false };
  }
}
