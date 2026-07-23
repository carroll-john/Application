import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { evaluateTranscriptEligibility } from "./client";

const fetchMock = vi.fn();
const originalFetch = globalThis.fetch;

function makeJsonResponse(payload: unknown, init: { status?: number } = {}) {
  return new Response(JSON.stringify(payload), {
    headers: { "content-type": "application/json" },
    status: init.status ?? 200,
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("evaluateTranscriptEligibility", () => {
  it("posts transcript and context to the eligibility proxy endpoint", async () => {
    fetchMock.mockResolvedValueOnce(
      makeJsonResponse({
        confidence: 0.87,
        outcome: "eligible",
        requirementsChecked: [],
      }),
    );

    const file = new File(["transcript"], "transcript.txt", { type: "text/plain" });
    const result = await evaluateTranscriptEligibility(file, {
      completed: true,
      courseCode: "MDA900",
      institution: "The University of Sydney",
      level: "Masters degree",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/evaluate-transcript-eligibility");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect(result.outcome).toBe("eligible");
  });

  it("marks UC credit assessment requests and sends the authenticated session", async () => {
    fetchMock.mockResolvedValueOnce(
      makeJsonResponse({
        confidence: 0.87,
        outcome: "eligible",
        requirementsChecked: [],
      }),
    );

    await evaluateTranscriptEligibility(
      new File(["transcript"], "transcript.txt", { type: "text/plain" }),
      {},
      { accessToken: "session-token", ucCreditAssessment: true },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/evaluate-transcript-eligibility?flow=uc-credit-assessment",
      expect.objectContaining({
        headers: { authorization: "Bearer session-token" },
        method: "POST",
      }),
    );
  });

  it("throws a typed request error for non-OK responses", async () => {
    fetchMock.mockResolvedValueOnce(
      makeJsonResponse(
        {
          code: "ELIGIBILITY_SERVICE_UPSTREAM_ERROR",
          error: "Service unavailable.",
        },
        { status: 503 },
      ),
    );

    await expect(
      evaluateTranscriptEligibility(
        new File(["transcript"], "transcript.txt", { type: "text/plain" }),
        {},
      ),
    ).rejects.toMatchObject({
      name: "TranscriptEligibilityRequestError",
      status: 503,
      code: "ELIGIBILITY_SERVICE_UPSTREAM_ERROR",
      message: "Service unavailable.",
    });
  });

  it("uses fallback message when error payload is not JSON", async () => {
    fetchMock.mockResolvedValueOnce(new Response("not-json", { status: 500 }));

    await expect(
      evaluateTranscriptEligibility(
        new File(["transcript"], "transcript.txt", { type: "text/plain" }),
        {},
      ),
    ).rejects.toMatchObject({
      name: "TranscriptEligibilityRequestError",
      status: 500,
      message: "Unable to evaluate transcript eligibility right now.",
    });
  });
});
