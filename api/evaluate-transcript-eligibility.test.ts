import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import eligibilityRoute from "./evaluate-transcript-eligibility";

const originalFetch = globalThis.fetch;
const fetchMock = vi.fn();

interface TranscriptServiceContractFixture {
  expectedOutcome: string;
  expectedPrimaryStatus: string;
  fixtureId: string;
  servicePayload: Record<string, unknown>;
}

function parseJsonResponse(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

function loadTranscriptServiceContractFixtures(): TranscriptServiceContractFixture[] {
  const fixturePath = new URL(
    "./__fixtures__/transcript-service-contract.json",
    import.meta.url,
  );
  const fileContents = readFileSync(fixturePath, "utf8");
  const parsed = JSON.parse(fileContents) as unknown;
  return Array.isArray(parsed) ? (parsed as TranscriptServiceContractFixture[]) : [];
}

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.ELIGIBILITY_SERVICE_URL;
  delete process.env.ELIGIBILITY_SERVICE_TOKEN;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_TRANSCRIPT_ELIGIBILITY_MODEL;
});

describe("evaluate-transcript-eligibility api route", () => {
  it("rejects non-POST requests", async () => {
    const response = await eligibilityRoute.fetch(
      new Request("https://example.test/api/evaluate-transcript-eligibility", {
        method: "GET",
      }),
    );

    const payload = await parseJsonResponse(response);
    expect(response.status).toBe(405);
    expect(payload.code).toBe("ELIGIBILITY_METHOD_NOT_ALLOWED");
  });

  it("returns fallback insufficient_data when service url is not configured", async () => {
    const formData = new FormData();
    formData.append("file", new File(["fixture"], "transcript.txt", { type: "text/plain" }));
    formData.append(
      "context",
      JSON.stringify({
        completed: true,
        courseCode: "MDA900",
        courseTitle: "Master of Data Analytics",
      }),
    );

    const response = await eligibilityRoute.fetch(
      new Request("https://example.test/api/evaluate-transcript-eligibility", {
        method: "POST",
        body: formData,
      }),
    );
    const payload = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(payload.outcome).toBe("insufficient_data");
    expect(payload.programCode).toBe("MDA900");
    expect(Array.isArray(payload.requirementsChecked)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards requests to configured eligibility service with auth token", async () => {
    process.env.ELIGIBILITY_SERVICE_URL = "https://eligibility.example.com/evaluate";
    process.env.ELIGIBILITY_SERVICE_TOKEN = "service-token";
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          confidence: 0.91,
          outcome: "eligible",
          requirementsChecked: [],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const formData = new FormData();
    formData.append("file", new File(["fixture"], "transcript.txt", { type: "text/plain" }));
    formData.append("context", JSON.stringify({ courseCode: "MBA101" }));

    const response = await eligibilityRoute.fetch(
      new Request("https://example.test/api/evaluate-transcript-eligibility", {
        method: "POST",
        body: formData,
      }),
    );
    const payload = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(payload.outcome).toBe("eligible");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://eligibility.example.com/evaluate");
    expect(init.method).toBe("POST");
    expect(init.headers).toBeInstanceOf(Headers);
    expect((init.headers as Headers).get("authorization")).toBe(
      "Bearer service-token",
    );
  });

  it("returns typed upstream error details when service responds non-ok", async () => {
    process.env.ELIGIBILITY_SERVICE_URL = "https://eligibility.example.com/evaluate";
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: "Eligibility engine failed.",
        }),
        { status: 502, headers: { "content-type": "application/json" } },
      ),
    );

    const formData = new FormData();
    formData.append("file", new File(["fixture"], "transcript.txt", { type: "text/plain" }));

    const response = await eligibilityRoute.fetch(
      new Request("https://example.test/api/evaluate-transcript-eligibility", {
        method: "POST",
        body: formData,
      }),
    );
    const payload = await parseJsonResponse(response);

    expect(response.status).toBe(502);
    expect(payload.code).toBe("ELIGIBILITY_SERVICE_UPSTREAM_ERROR");
    expect(payload.error).toBe("Eligibility engine failed.");
  });

  it("uses local OpenAI evaluation when service URL is unset", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_TRANSCRIPT_ELIGIBILITY_MODEL = "gpt-4.1-mini";
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          output_parsed: {
            confidence: 0.88,
            manualReviewRequired: false,
            missingInformation: [],
            outcome: "eligible",
            recommendedNextStep: "Proceed to formal admissions assessment.",
            requirementsChecked: [
              {
                explanation: "Completion and academic evidence are sufficient.",
                id: "primary-requirement",
                requirement: "Primary academic eligibility requirement",
                status: "pass",
              },
            ],
          },
          status: "completed",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const formData = new FormData();
    formData.append("file", new File(["fixture"], "transcript.txt", { type: "text/plain" }));
    formData.append("context", JSON.stringify({ courseCode: "MBA101" }));

    const response = await eligibilityRoute.fetch(
      new Request("https://example.test/api/evaluate-transcript-eligibility", {
        method: "POST",
        body: formData,
      }),
    );
    const payload = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(payload.outcome).toBe("eligible");
    expect(payload.programCode).toBe("MBA101");
    expect(payload.serviceVersion).toBe("local-openai-fallback");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("replays all transcript contract fixtures through the proxy route", async () => {
    process.env.ELIGIBILITY_SERVICE_URL = "https://eligibility.example.com/evaluate";
    const fixtures = loadTranscriptServiceContractFixtures();

    for (const fixture of fixtures) {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(fixture.servicePayload), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

      const formData = new FormData();
      formData.append("file", new File(["fixture"], `${fixture.fixtureId}.txt`, { type: "text/plain" }));
      formData.append("context", JSON.stringify({ courseCode: "TEST-PROGRAM" }));

      const response = await eligibilityRoute.fetch(
        new Request("https://example.test/api/evaluate-transcript-eligibility", {
          method: "POST",
          body: formData,
        }),
      );
      const payload = await parseJsonResponse(response);

      expect(response.status).toBe(200);
      expect(payload.outcome).toBe(fixture.expectedOutcome);
      expect(payload.requirementsChecked).toBeInstanceOf(Array);
      expect((payload.requirementsChecked as Array<Record<string, unknown>>)[0]?.status).toBe(
        fixture.expectedPrimaryStatus,
      );
    }

    expect(fixtures).toHaveLength(12);
    expect(fetchMock).toHaveBeenCalledTimes(fixtures.length);
  });
});

