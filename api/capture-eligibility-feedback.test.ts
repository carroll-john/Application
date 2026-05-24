import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import feedbackRoute from "./capture-eligibility-feedback";

const originalFetch = globalThis.fetch;
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
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
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards a captured override event to PostHog when configured", async () => {
    process.env.POSTHOG_PROJECT_API_KEY = "test-key";
    fetchMock.mockResolvedValueOnce(new Response("", { status: 200 }));

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
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/posthog\.com\/i\/v0\/e\//);
    const body = JSON.parse((init as { body: string }).body) as {
      event: string;
      properties: Record<string, unknown>;
    };
    expect(body.event).toBe("eligibility_check_override");
    expect(body.properties.requirement_id).toBe("wam-65");
    expect(body.properties.original_status).toBe("fail");
    expect(body.properties.override_status).toBe("pass");
    expect(body.properties.course_code).toBe("mit-online");
  });
});
