import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureTranscriptAiGeneration } from "./posthogAiObservability";

const fetchMock = vi.hoisted(() => vi.fn());

beforeEach(() => {
  fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  delete process.env.APP_ENVIRONMENT;
  delete process.env.POSTHOG_HOST;
  delete process.env.POSTHOG_PROJECT_API_KEY;
  delete process.env.VERCEL_ENV;
  delete process.env.VITE_APP_ENVIRONMENT;
});

describe("captureTranscriptAiGeneration", () => {
  it("stamps AI generation events with app environment", async () => {
    process.env.POSTHOG_PROJECT_API_KEY = "test-key";
    process.env.VERCEL_ENV = "preview";

    await captureTranscriptAiGeneration({
      context: {
        courseCode: "mit-online",
        courseTitle: "Master of Information Technology",
      },
      evaluationSource: "local_openai",
      fileName: "transcript.pdf",
      latencyMs: 1234,
      model: "gpt-test",
      output: {
        outcome: "eligible",
        requirementsChecked: [],
      },
      provider: "openai",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const form = init.body as FormData;
    const propertiesBlob = form.get("event.properties") as Blob;
    const properties = JSON.parse(await propertiesBlob.text()) as Record<
      string,
      unknown
    >;

    expect(properties.app_environment).toBe("preview");
    expect(properties.eligibility_pipeline).toBe("transcript_eligibility_v1");
  });
});
