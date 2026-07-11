import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reportAuthSignUpSucceeded } from "./authSignUpAnalyticsClient";

const isSyntheticTestSession = vi.hoisted(() => vi.fn());

vi.mock("./posthog", () => ({
  isSyntheticTestSession,
}));

const fetchMock = vi.fn();

beforeEach(() => {
  isSyntheticTestSession.mockReturnValue(false);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function sentBody(): Record<string, unknown> {
  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

describe("reportAuthSignUpSucceeded", () => {
  it("posts the payload without a synthetic flag for real sessions", async () => {
    const result = await reportAuthSignUpSucceeded({
      userId: "550e8400-e29b-41d4-a716-446655440000",
      signupMethod: "email",
      emailDomain: "example.com",
      authContext: "eligibility",
    });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/capture-auth-sign-up-succeeded",
      expect.objectContaining({ method: "POST" }),
    );
    expect(sentBody()).toEqual({
      userId: "550e8400-e29b-41d4-a716-446655440000",
      signupMethod: "email",
      emailDomain: "example.com",
      authContext: "eligibility",
    });
  });

  it("forwards syntheticTest for authorised QA sessions", async () => {
    isSyntheticTestSession.mockReturnValue(true);

    await reportAuthSignUpSucceeded({
      userId: "550e8400-e29b-41d4-a716-446655440000",
      signupMethod: "email",
    });

    expect(sentBody()).toMatchObject({ syntheticTest: true });
  });

  it("never throws when the capture route is unreachable", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    await expect(
      reportAuthSignUpSucceeded({
        userId: "550e8400-e29b-41d4-a716-446655440000",
        signupMethod: "email",
      }),
    ).resolves.toEqual({ ok: false });
  });
});
