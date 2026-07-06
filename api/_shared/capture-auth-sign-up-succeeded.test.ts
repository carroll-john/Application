import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const captureImmediate = vi.hoisted(() => vi.fn());
const PostHogMock = vi.hoisted(() =>
  vi.fn(function PostHog() {
    return { captureImmediate };
  }),
);

vi.mock("posthog-node", () => ({ PostHog: PostHogMock }));

import signUpRoute from "../capture-auth-sign-up-succeeded";

beforeEach(() => {
  captureImmediate.mockReset();
  captureImmediate.mockResolvedValue(undefined);
});

afterEach(() => {
  delete process.env.APP_ENVIRONMENT;
  delete process.env.POSTHOG_PROJECT_API_KEY;
  delete process.env.POSTHOG_HOST;
  delete process.env.VERCEL_ENV;
  delete process.env.VITE_APP_ENVIRONMENT;
});

function makeRequest(body: unknown, method: string = "POST") {
  return new Request("https://example.test/api/capture-auth-sign-up-succeeded", {
    method,
    headers: { "content-type": "application/json" },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
}

describe("capture-auth-sign-up-succeeded api route", () => {
  it("rejects non-POST methods", async () => {
    const response = await signUpRoute.fetch(makeRequest({}, "GET"));
    expect(response.status).toBe(405);
  });

  it("rejects invalid user ids", async () => {
    const response = await signUpRoute.fetch(
      makeRequest({ userId: "not-a-uuid", signupMethod: "email" }),
    );
    expect(response.status).toBe(400);
    const payload = (await response.json()) as { code: string };
    expect(payload.code).toBe("AUTH_SIGN_UP_SUCCEEDED_INVALID_USER_ID");
  });

  it("rejects unknown signup methods", async () => {
    const response = await signUpRoute.fetch(
      makeRequest({
        userId: "550e8400-e29b-41d4-a716-446655440000",
        signupMethod: "twitter",
      }),
    );
    expect(response.status).toBe(400);
    const payload = (await response.json()) as { code: string };
    expect(payload.code).toBe("AUTH_SIGN_UP_SUCCEEDED_INVALID_SIGNUP_METHOD");
  });

  it("returns ok and skips PostHog when API key is not configured", async () => {
    delete process.env.POSTHOG_PROJECT_API_KEY;
    const response = await signUpRoute.fetch(
      makeRequest({
        userId: "550e8400-e29b-41d4-a716-446655440000",
        signupMethod: "email",
        emailDomain: "example.com",
        authContext: "route",
      }),
    );
    expect(response.status).toBe(200);
    expect(captureImmediate).not.toHaveBeenCalled();
  });

  it("forwards auth_sign_up_succeeded to PostHog with dedupe insert id", async () => {
    process.env.POSTHOG_PROJECT_API_KEY = "test-key";
    process.env.VERCEL_ENV = "preview";
    const userId = "550e8400-e29b-41d4-a716-446655440000";

    const response = await signUpRoute.fetch(
      makeRequest({
        userId,
        signupMethod: "email",
        emailDomain: "example.com",
        authContext: "modal",
      }),
    );

    expect(response.status).toBe(200);
    expect(captureImmediate).toHaveBeenCalledTimes(1);
    const event = captureImmediate.mock.calls[0][0] as {
      distinctId: string;
      event: string;
      properties: Record<string, unknown>;
    };
    expect(event.event).toBe("auth_sign_up_succeeded");
    expect(event.distinctId).toMatch(/^sha256:/);
    expect(event.properties.app_environment).toBe("preview");
    expect(event.properties.signup_method).toBe("email");
    expect(event.properties.email_domain).toBe("example.com");
    expect(event.properties.auth_context).toBe("modal");
    expect(event.properties.$insert_id).toBe(`auth-sign-up-succeeded:${userId}`);
  });

  it("waits for PostHog capture before returning", async () => {
    process.env.POSTHOG_PROJECT_API_KEY = "test-key";
    let resolveCapture!: () => void;
    captureImmediate.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveCapture = resolve;
      }),
    );

    let settled = false;
    const responsePromise = signUpRoute
      .fetch(
        makeRequest({
          userId: "550e8400-e29b-41d4-a716-446655440000",
          signupMethod: "email",
        }),
      )
      .then((response) => {
        settled = true;
        return response;
      });

    await Promise.resolve();
    expect(settled).toBe(false);

    resolveCapture();
    const response = await responsePromise;

    expect(response.status).toBe(200);
    expect(settled).toBe(true);
  });
});
