import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const captureImmediate = vi.hoisted(() => vi.fn());
const PostHogMock = vi.hoisted(() =>
  vi.fn(function PostHog() {
    return { captureImmediate };
  }),
);

vi.mock("posthog-node", () => ({ PostHog: PostHogMock }));

import feedbackRoute from "./capture-eligibility-feedback";

beforeEach(() => {
  captureImmediate.mockReset();
  captureImmediate.mockResolvedValue(undefined);
});

afterEach(() => {
  delete process.env.POSTHOG_PROJECT_API_KEY;
  delete process.env.POSTHOG_HOST;
});

function makeRequest(body: unknown, method: string = "POST") {
  return new Request("https://example.test/api/capture-eligibility-feedback", {
    method,
    headers: { "content-type": "application/json" },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
}

describe("capture-eligibility-feedback api route", () => {
  it("rejects non-POST methods", async () => {
    const response = await feedbackRoute.fetch(makeRequest({}, "GET"));
    expect(response.status).toBe(405);
  });

  it("rejects bodies missing required fields", async () => {
    const response = await feedbackRoute.fetch(
      makeRequest({ requirementId: "x", originalStatus: "pass" }),
    );
    expect(response.status).toBe(400);
    const payload = (await response.json()) as { code: string };
    expect(payload.code).toBe("ELIGIBILITY_FEEDBACK_REQUIRED_FIELDS_MISSING");
  });

  it("returns ok and skips PostHog when API key is not configured", async () => {
    delete process.env.POSTHOG_PROJECT_API_KEY;
    const response = await feedbackRoute.fetch(
      makeRequest({
        requirementId: "completion",
        originalStatus: "pass",
        overrideStatus: "fail",
        reason: "Award conferral not yet recorded.",
      }),
    );
    expect(response.status).toBe(200);
    expect(captureImmediate).not.toHaveBeenCalled();
  });

  it("forwards a captured override event to PostHog when configured", async () => {
    process.env.POSTHOG_PROJECT_API_KEY = "test-key";

    const response = await feedbackRoute.fetch(
      makeRequest({
        requirementId: "wam-65",
        requirementSourceText: "WAM 65% or above.",
        originalStatus: "fail",
        overrideStatus: "pass",
        reason: "Updated transcript shows WAM 71.",
        courseCode: "mit-online",
        courseTitle: "Master of Information Technology",
      }),
    );

    expect(response.status).toBe(200);
    expect(captureImmediate).toHaveBeenCalledTimes(1);
    const event = captureImmediate.mock.calls[0][0] as {
      distinctId: string;
      event: string;
      properties: Record<string, unknown>;
    };
    expect(event.event).toBe("eligibility_check_override");
    expect(typeof event.distinctId).toBe("string");
    expect(event.properties.requirement_id).toBe("wam-65");
    expect(event.properties.original_status).toBe("fail");
    expect(event.properties.override_status).toBe("pass");
    expect(event.properties.course_code).toBe("mit-online");
  });
});
