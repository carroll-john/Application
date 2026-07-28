import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import eligibilityRoute, {
  ELIGIBILITY_SERVICE_REQUEST_TIMEOUT_MS,
} from "./evaluate-transcript-eligibility";
import { RULES_VERSION } from "../src/lib/eligibility/version";

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
  delete process.env.POSTHOG_PROJECT_API_KEY;
  delete process.env.POSTHOG_HOST;
  delete process.env.VITE_POSTHOG_HOST;
  delete process.env.VITE_SUPABASE_ANON_KEY;
  delete process.env.VITE_SUPABASE_URL;
  delete process.env.VERCEL_ENV;
});

afterEach(() => {
  vi.useRealTimers();
  globalThis.fetch = originalFetch;
  delete process.env.ELIGIBILITY_SERVICE_URL;
  delete process.env.ELIGIBILITY_SERVICE_TOKEN;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_TRANSCRIPT_ELIGIBILITY_MODEL;
  delete process.env.POSTHOG_PROJECT_API_KEY;
  delete process.env.POSTHOG_HOST;
  delete process.env.VITE_POSTHOG_HOST;
  delete process.env.VITE_SUPABASE_ANON_KEY;
  delete process.env.VITE_SUPABASE_URL;
  delete process.env.VERCEL_ENV;
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

  it("rejects an unauthenticated UC credit assessment before reading the transcript", async () => {
    process.env.VITE_SUPABASE_URL = "https://project.supabase.co";
    process.env.VITE_SUPABASE_ANON_KEY = "anon-key";
    process.env.VERCEL_ENV = "preview";
    const formData = new FormData();
    formData.append(
      "file",
      new File(["private transcript"], "transcript.txt", {
        type: "text/plain",
      }),
    );

    const response = await eligibilityRoute.fetch(
      new Request(
        "https://example.test/api/evaluate-transcript-eligibility?flow=uc-credit-assessment",
        { body: formData, method: "POST" },
      ),
    );
    const payload = await parseJsonResponse(response);

    expect(response.status).toBe(401);
    expect(payload.code).toBe("UC_CREDIT_ASSESSMENT_UNAUTHORIZED");
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
    formData.append("context", JSON.stringify({ completed: true, courseCode: "MBA101" }));

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

  it("redacts raw transcript filenames from PostHog AI observability input", async () => {
    process.env.ELIGIBILITY_SERVICE_URL = "https://eligibility.example.com/evaluate";
    process.env.POSTHOG_PROJECT_API_KEY = "ph-project-key";
    process.env.POSTHOG_HOST = "https://posthog.example";
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
    formData.append(
      "file",
      new File(["fixture"], "Jane-Doe-student-123-transcript.txt", {
        type: "text/plain",
      }),
    );
    formData.append("context", JSON.stringify({ completed: true, courseCode: "MBA101" }));

    const response = await eligibilityRoute.fetch(
      new Request("https://example.test/api/evaluate-transcript-eligibility", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [posthogUrl, posthogInit] = fetchMock.mock.calls[1];
    expect(posthogUrl).toBe("https://posthog.example/i/v0/ai/");
    expect(posthogInit.body).toBeInstanceOf(FormData);

    const aiInputPart = (posthogInit.body as FormData).get("event.properties.$ai_input");
    expect(aiInputPart).toBeTruthy();
    expect(typeof (aiInputPart as Blob).text).toBe("function");

    const aiInput = JSON.parse(await (aiInputPart as Blob).text()) as Array<{
      content: string;
      role: string;
    }>;
    const serializedInput = JSON.stringify(aiInput);
    expect(serializedInput).not.toContain("Jane-Doe");
    expect(serializedInput).not.toContain("student-123");
    expect(serializedInput).not.toContain("transcript.txt");

    const summarizedInput = JSON.parse(aiInput[0].content) as Record<string, unknown>;
    expect(summarizedInput).not.toHaveProperty("fileName");
    expect(summarizedInput.document).toEqual({
      fileExtension: "txt",
      kind: "transcript",
      mimeType: "text/plain",
      sizeBucket: "0-10kb",
    });
  });

  it("returns typed upstream error details when service responds non-ok", async () => {
    process.env.ELIGIBILITY_SERVICE_URL = "https://eligibility.example.com/evaluate";
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Eligibility engine failed." }), {
          status: 502,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Eligibility engine failed." }), {
          status: 502,
          headers: { "content-type": "application/json" },
        }),
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
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries one transient upstream response before returning a successful assessment", async () => {
    process.env.ELIGIBILITY_SERVICE_URL = "https://eligibility.example.com/evaluate";
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Eligibility engine is warming up." }), {
          status: 502,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            confidence: 0.95,
            outcome: "eligible",
            requirementsChecked: [],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );

    const formData = new FormData();
    formData.append("file", new File(["fixture"], "transcript.txt", { type: "text/plain" }));
    formData.append("context", JSON.stringify({ completed: true }));

    const response = await eligibilityRoute.fetch(
      new Request("https://example.test/api/evaluate-transcript-eligibility", {
        method: "POST",
        body: formData,
      }),
    );
    const payload = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(payload.outcome).toBe("eligible");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("bounds a stalled service request and uses the local OpenAI fallback", async () => {
    vi.useFakeTimers();
    process.env.ELIGIBILITY_SERVICE_URL = "https://eligibility.example.com/evaluate";
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_TRANSCRIPT_ELIGIBILITY_MODEL = "gpt-4.1-mini";
    fetchMock
      .mockImplementationOnce((_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("The request was aborted.", "AbortError")),
            { once: true },
          );
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            output_parsed: {
              confidence: 0.88,
              manualReviewRequired: false,
              missingInformation: [],
              outcome: "eligible",
              recommendedNextStep: "Proceed to formal admissions assessment.",
              requirementsChecked: [],
              studyDetails: {
                programName: {
                  confidence: 0.9,
                  missingOrAmbiguous: false,
                  normalizedValue: "Bachelor of Arts / Bachelor of Laws",
                  originalValue: "Bachelor of Arts / Bachelor of Laws",
                },
              },
            },
            status: "completed",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );

    const formData = new FormData();
    formData.append(
      "file",
      new File(["fixture"], "transcript.txt", { type: "text/plain" }),
    );
    formData.append(
      "context",
      JSON.stringify({ completed: true, courseCode: "UC-A,UC-B,UC-C" }),
    );

    const responsePromise = eligibilityRoute.fetch(
      new Request("https://example.test/api/evaluate-transcript-eligibility", {
        method: "POST",
        body: formData,
      }),
    );

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(ELIGIBILITY_SERVICE_REQUEST_TIMEOUT_MS);
    const response = await responsePromise;
    const payload = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(payload.outcome).toBe("eligible");
    expect(payload.serviceVersion).toBe("local-openai-fallback");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://eligibility.example.com/evaluate",
    );
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.openai.com/v1/responses");
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
    formData.append("context", JSON.stringify({ completed: true, courseCode: "MBA101" }));

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
      formData.append("context", JSON.stringify({ completed: true, courseCode: "TEST-PROGRAM" }));

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
      const checks = payload.requirementsChecked as Array<Record<string, unknown>>;
      expect(checks.length).toBeGreaterThan(0);
      expect(
        checks.every(
          (check) => typeof check.id === "string" && (check.id as string).startsWith("deterministic-"),
        ),
      ).toBe(true);
    }

    expect(fixtures).toHaveLength(12);
    expect(fetchMock).toHaveBeenCalledTimes(fixtures.length);
  });

  it("marks ineligible when deterministic WAM threshold fails", async () => {
    process.env.ELIGIBILITY_SERVICE_URL = "https://eligibility.example.com/evaluate";
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          confidence: 0.93,
          manualReviewRequired: false,
          missingInformation: [],
          outcome: "eligible",
          recommendedNextStep: "Proceed",
          requirementsChecked: [],
          academicPerformance: {
            gradeAverageOrWam: {
              confidence: 0.9,
              missingOrAmbiguous: false,
              normalizedValue: "60",
              originalValue: "WAM 60",
            },
          },
          applicantDetails: {},
          englishLanguageEvidence: {},
          studyDetails: {},
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const formData = new FormData();
    formData.append("file", new File(["fixture"], "threshold.txt", { type: "text/plain" }));
    formData.append("context", JSON.stringify({ minWam: 65 }));

    const response = await eligibilityRoute.fetch(
      new Request("https://example.test/api/evaluate-transcript-eligibility", {
        method: "POST",
        body: formData,
      }),
    );
    const payload = await parseJsonResponse(response);
    const deterministicCheck = (payload.requirementsChecked as Array<Record<string, unknown>>).find(
      (check) => check.id === "deterministic-wam-gpa-threshold",
    );

    expect(response.status).toBe(200);
    expect(payload.outcome).toBe("ineligible");
    expect(deterministicCheck?.status).toBe("fail");
  });

  it("uses external-service unit results to calculate WAM when no aggregate WAM is present", async () => {
    process.env.ELIGIBILITY_SERVICE_URL = "https://eligibility.example.com/evaluate";
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          confidence: 0.93,
          manualReviewRequired: false,
          missingInformation: [],
          outcome: "eligible",
          recommendedNextStep: "Proceed",
          requirementsChecked: [],
          academicPerformance: {
            gpa: {
              confidence: 0.9,
              missingOrAmbiguous: false,
              normalizedValue: "5.25",
              originalValue: "GPA for conferred exit award 5.25",
            },
            gpaScale: {
              confidence: 0.7,
              missingOrAmbiguous: true,
              normalizedValue: "7",
              originalValue: "Australian seven-point GPA scale inferred from context",
            },
            unitResults: [
              { counted: true, creditPoints: 10, grade: "D", mark: 71 },
              { counted: true, creditPoints: 10, grade: "Cr", mark: 66 },
              { counted: true, creditPoints: 10, grade: "P", mark: 58 },
              { counted: true, creditPoints: 10, grade: "S", mark: null },
              { counted: true, creditPoints: 10, grade: "F", mark: 41 },
              { counted: true, creditPoints: 10, grade: "W", mark: null },
            ],
          },
          applicantDetails: {},
          englishLanguageEvidence: {},
          studyDetails: {},
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const formData = new FormData();
    formData.append("file", new File(["fixture"], "macquarie.txt", { type: "text/plain" }));
    formData.append("context", JSON.stringify({ minWam: 60 }));

    const response = await eligibilityRoute.fetch(
      new Request("https://example.test/api/evaluate-transcript-eligibility", {
        method: "POST",
        body: formData,
      }),
    );
    const payload = await parseJsonResponse(response);
    const deterministicCheck = (payload.requirementsChecked as Array<Record<string, unknown>>).find(
      (check) => check.id === "deterministic-wam-gpa-threshold",
    );

    expect(response.status).toBe(200);
    expect(payload.outcome).toBe("ineligible");
    expect(deterministicCheck?.status).toBe("fail");
    expect(deterministicCheck?.reasonCode).toBe("WAM_BELOW");
    expect(deterministicCheck?.details).toMatchObject({
      metric: "wam",
      observed: "59.0",
      required: "60",
    });
  });

  it("returns insufficient_data when no mappable WAM/GPA evidence exists", async () => {
    process.env.ELIGIBILITY_SERVICE_URL = "https://eligibility.example.com/evaluate";
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          confidence: 0.82,
          manualReviewRequired: false,
          missingInformation: [],
          outcome: "eligible",
          recommendedNextStep: "Proceed",
          requirementsChecked: [],
          academicPerformance: {},
          applicantDetails: {},
          englishLanguageEvidence: {},
          studyDetails: {},
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const formData = new FormData();
    formData.append("file", new File(["fixture"], "unknown-threshold.txt", { type: "text/plain" }));
    formData.append("context", JSON.stringify({ minWam: 65 }));

    const response = await eligibilityRoute.fetch(
      new Request("https://example.test/api/evaluate-transcript-eligibility", {
        method: "POST",
        body: formData,
      }),
    );
    const payload = await parseJsonResponse(response);
    const deterministicCheck = (payload.requirementsChecked as Array<Record<string, unknown>>).find(
      (check) => check.id === "deterministic-wam-gpa-threshold",
    );

    expect(response.status).toBe(200);
    expect(payload.outcome).toBe("insufficient_data");
    expect(deterministicCheck?.status).toBe("unknown");
  });

  it("uses the requirements matcher when canonical requirements are supplied", async () => {
    process.env.ELIGIBILITY_SERVICE_URL = "https://eligibility.example.com/evaluate";
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          confidence: 0.9,
          outcome: "eligible",
          academicPerformance: {
            gradeAverageOrWam: {
              confidence: 0.9,
              missingOrAmbiguous: false,
              normalizedValue: "78.6",
              originalValue: "WAM 78.6",
            },
          },
          applicantDetails: {
            countryOfInstitution: {
              confidence: 0.9,
              missingOrAmbiguous: false,
              normalizedValue: "Australia",
              originalValue: "Australia",
            },
          },
          studyDetails: {
            completionStatus: {
              confidence: 0.9,
              missingOrAmbiguous: false,
              normalizedValue: "completed",
              originalValue: "completed",
            },
          },
          englishLanguageEvidence: {},
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const requirements = [
      {
        id: "completion",
        kind: "qualification_completed",
        params: {},
        sourceText: "Successful completion of an Australian bachelor degree.",
        weight: "mandatory",
      },
      {
        id: "wam-65",
        kind: "academic_threshold",
        params: { metric: "wam", min: 65 },
        sourceText: "WAM 65% or above.",
        weight: "mandatory",
      },
      {
        id: "english",
        kind: "english_proficiency",
        params: {
          acceptedPathways: [
            { type: "completion_in_country", countries: ["AU", "NZ", "UK", "IE", "US", "CA", "ZA"] },
          ],
        },
        sourceText: "Evidence of English language proficiency or completion in English.",
        weight: "mandatory",
      },
    ];

    const formData = new FormData();
    formData.append("file", new File(["fixture"], "matcher.txt", { type: "text/plain" }));
    formData.append("context", JSON.stringify({ requirements }));

    const response = await eligibilityRoute.fetch(
      new Request("https://example.test/api/evaluate-transcript-eligibility", {
        method: "POST",
        body: formData,
      }),
    );
    const payload = await parseJsonResponse(response);

    const checks = payload.requirementsChecked as Array<Record<string, unknown>>;
    expect(response.status).toBe(200);
    expect(payload.outcome).toBe("eligible");
    expect(payload.manualReviewRequired).toBe(false);
    expect(checks.map((check) => check.id)).toEqual(["completion", "wam-65", "english"]);
    expect(checks.every((check) => check.status === "pass")).toBe(true);
    expect(payload.rulesVersion).toBe(RULES_VERSION);
  });

  it("returns conditionally_eligible when only a conditional requirement fails", async () => {
    process.env.ELIGIBILITY_SERVICE_URL = "https://eligibility.example.com/evaluate";
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          confidence: 0.9,
          outcome: "eligible",
          studyDetails: {
            completionStatus: {
              confidence: 0.9,
              normalizedValue: "completed",
              originalValue: "completed",
            },
            programName: {
              confidence: 0.9,
              normalizedValue: "Bachelor of Arts",
              originalValue: "Bachelor of Arts",
            },
          },
          applicantDetails: {},
          academicPerformance: {},
          englishLanguageEvidence: {},
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const requirements = [
      {
        id: "completion",
        kind: "qualification_completed",
        params: {},
        sourceText: "Successful completion of a bachelor degree.",
        weight: "mandatory",
      },
      {
        id: "field",
        kind: "field_of_study",
        params: { acceptedAreas: ["business"] },
        sourceText: "Preferably a business-related background.",
        weight: "conditional",
      },
    ];

    const formData = new FormData();
    formData.append("file", new File(["fixture"], "conditional.txt", { type: "text/plain" }));
    formData.append("context", JSON.stringify({ requirements }));

    const response = await eligibilityRoute.fetch(
      new Request("https://example.test/api/evaluate-transcript-eligibility", {
        method: "POST",
        body: formData,
      }),
    );
    const payload = await parseJsonResponse(response);
    const checks = payload.requirementsChecked as Array<Record<string, unknown>>;

    expect(response.status).toBe(200);
    expect(payload.outcome).toBe("conditionally_eligible");
    expect(payload.manualReviewRequired).toBe(true);
    expect(payload.rulesVersion).toBe(RULES_VERSION);
    const fieldCheck = checks.find((check) => check.id === "field");
    expect(fieldCheck?.status).toBe("fail");
    expect(fieldCheck?.reasonCode).toBe("FIELD_MISMATCH");
  });

  it("passes English proficiency for Australian institution completion", async () => {
    process.env.ELIGIBILITY_SERVICE_URL = "https://eligibility.example.com/evaluate";
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          confidence: 0.85,
          manualReviewRequired: false,
          missingInformation: [],
          outcome: "eligible",
          recommendedNextStep: "Proceed",
          academicPerformance: {
            gradeAverageOrWam: {
              confidence: 0.9,
              missingOrAmbiguous: false,
              normalizedValue: "78",
              originalValue: "WAM 78",
            },
          },
          applicantDetails: {
            institutionName: {
              confidence: 0.9,
              missingOrAmbiguous: false,
              normalizedValue: "The University of Melbourne",
              originalValue: "The University of Melbourne",
            },
            countryOfInstitution: {
              confidence: 0.9,
              missingOrAmbiguous: false,
              normalizedValue: "Australia",
              originalValue: "Australia",
            },
          },
          englishLanguageEvidence: {},
          studyDetails: {
            completionStatus: {
              confidence: 0.9,
              missingOrAmbiguous: false,
              normalizedValue: "completed",
              originalValue: "completed",
            },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const formData = new FormData();
    formData.append("file", new File(["fixture"], "au-english.txt", { type: "text/plain" }));
    formData.append("context", JSON.stringify({ minWam: 65 }));

    const response = await eligibilityRoute.fetch(
      new Request("https://example.test/api/evaluate-transcript-eligibility", {
        method: "POST",
        body: formData,
      }),
    );
    const payload = await parseJsonResponse(response);
    const englishCheck = (payload.requirementsChecked as Array<Record<string, unknown>>).find(
      (check) => check.id === "deterministic-english-proficiency",
    );
    const englishEvidence = payload.englishLanguageEvidence as Record<string, unknown>;
    const englishInstructionEvidence = englishEvidence
      .englishInstructionEvidence as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(payload.outcome).toBe("eligible");
    expect(payload.manualReviewRequired).toBe(false);
    expect(englishCheck?.status).toBe("pass");
    expect(englishInstructionEvidence.normalizedValue).toBe(
      "english_instruction_au_institution",
    );
  });

  it("overrides an upstream verdict and checkedAt that contradict all-passing deterministic checks", async () => {
    // Production incident shape: the external service returned insufficient_data,
    // manualReviewRequired and a checkedAt years in the past alongside evidence whose
    // deterministic checks all pass.
    process.env.ELIGIBILITY_SERVICE_URL = "https://eligibility.example.com/evaluate";
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          checkedAt: "2024-06-05T00:00:00Z",
          confidence: 0.8,
          manualReviewRequired: true,
          outcome: "insufficient_data",
          requirementsChecked: [],
          applicantDetails: {
            countryOfInstitution: {
              confidence: 0.9,
              missingOrAmbiguous: false,
              normalizedValue: "Australia",
              originalValue: "Australia",
            },
            institutionName: {
              confidence: 0.9,
              missingOrAmbiguous: false,
              normalizedValue: "The University of Melbourne",
              originalValue: "The University of Melbourne",
            },
          },
          studyDetails: {
            completionStatus: {
              confidence: 0.9,
              missingOrAmbiguous: false,
              normalizedValue: "completed",
              originalValue: "completed",
            },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const formData = new FormData();
    formData.append("file", new File(["fixture"], "au-pass.txt", { type: "text/plain" }));
    formData.append("context", JSON.stringify({ completed: true }));

    const before = Date.now();
    const response = await eligibilityRoute.fetch(
      new Request("https://example.test/api/evaluate-transcript-eligibility", {
        method: "POST",
        body: formData,
      }),
    );
    const payload = await parseJsonResponse(response);
    const statuses = (payload.requirementsChecked as Array<Record<string, unknown>>).map(
      (check) => check.status,
    );

    expect(response.status).toBe(200);
    expect(statuses.every((status) => status === "pass")).toBe(true);
    expect(payload.outcome).toBe("eligible");
    expect(payload.manualReviewRequired).toBe(false);
    // checkedAt is re-stamped server-side so a hallucinated old date can't outrank fresh scans
    expect(Date.parse(payload.checkedAt as string)).toBeGreaterThanOrEqual(before - 1000);
  });

  it("does not degrade the transcript verdict for requirements another document proves (screenshot scenario)", async () => {
    // A strong AU bachelor transcript (completed, GPA 5.25/7, English by country) applying to an
    // MBA that also wants 3+ years work experience. The transcript can never prove work
    // experience, so it must surface as pendingEvidence — not drag the outcome to
    // insufficient_data or produce contradicting "missing information" bullets.
    process.env.ELIGIBILITY_SERVICE_URL = "https://eligibility.example.com/evaluate";
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          confidence: 0.9,
          outcome: "eligible",
          missingInformation: [
            "Qualification level could not be mapped from transcript evidence.",
          ],
          recommendedNextStep: "Provide clearer transcript evidence and route for manual review.",
          academicPerformance: {
            gpa: {
              confidence: 0.95,
              missingOrAmbiguous: false,
              normalizedValue: "5.25",
              originalValue: "GPA 5.25",
            },
            gpaScale: {
              confidence: 0.95,
              missingOrAmbiguous: false,
              normalizedValue: "7",
              originalValue: "out of 7.0",
            },
          },
          applicantDetails: {
            countryOfInstitution: {
              confidence: 0.9,
              missingOrAmbiguous: false,
              normalizedValue: "Australia",
              originalValue: "Australia",
            },
          },
          studyDetails: {
            completionStatus: {
              confidence: 0.92,
              missingOrAmbiguous: false,
              normalizedValue: "completed",
              originalValue: "Award conferred",
            },
            highestEducationLevel: {
              confidence: 0.88,
              missingOrAmbiguous: false,
              normalizedValue: "bachelor",
              originalValue: "Bachelor of Business",
            },
          },
          englishLanguageEvidence: {},
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const requirements = [
      {
        id: "completion",
        kind: "qualification_completed",
        params: {},
        sourceText: "Completed bachelor degree or higher.",
        weight: "mandatory",
      },
      {
        id: "level",
        kind: "qualification_level",
        params: { level: "bachelor" },
        sourceText: "Bachelor degree or higher.",
        weight: "mandatory",
      },
      {
        id: "gpa",
        kind: "academic_threshold",
        params: { metric: "gpa", min: 4, scale: 7 },
        sourceText: "Minimum GPA of 4 on a 7-point scale.",
        weight: "mandatory",
      },
      {
        id: "english",
        kind: "english_proficiency",
        params: { acceptedPathways: [{ type: "completion_in_country", countries: ["AU"] }] },
        sourceText: "English language proficiency.",
        weight: "mandatory",
      },
      {
        id: "work",
        kind: "work_experience",
        params: { minYears: 3 },
        sourceText: "At least 3 years of relevant work experience.",
        weight: "mandatory",
      },
    ];

    const formData = new FormData();
    formData.append("file", new File(["fixture"], "mba.txt", { type: "text/plain" }));
    formData.append("context", JSON.stringify({ requirements }));

    const response = await eligibilityRoute.fetch(
      new Request("https://example.test/api/evaluate-transcript-eligibility", {
        method: "POST",
        body: formData,
      }),
    );
    const payload = await parseJsonResponse(response);
    const checks = payload.requirementsChecked as Array<Record<string, unknown>>;

    expect(response.status).toBe(200);
    // Transcript-scoped verdict: everything the transcript can prove passed.
    expect(payload.outcome).toBe("eligible");
    expect(payload.manualReviewRequired).toBe(false);
    // The work-experience gap is a pending-evidence prompt, not a transcript failure.
    expect(payload.pendingEvidence).toEqual([
      {
        evidenceSource: "cv",
        kind: "work_experience",
        reasonCode: "WORK_EXPERIENCE_UNVERIFIED",
        requirementId: "work",
      },
    ]);
    // The full check list still includes the unknown work-experience check for the UI cards.
    expect(checks.map((check) => [check.id, check.status])).toEqual([
      ["completion", "pass"],
      ["level", "pass"],
      ["gpa", "pass"],
      ["english", "pass"],
      ["work", "unknown"],
    ]);
    // Invariant: no missing-information bullet may exist for a passed requirement — the LLM's
    // free-text observations are demoted to non-rendered extractionNotes.
    expect(payload.missingInformation).toEqual([]);
    expect(payload.extractionNotes).toEqual([
      "Qualification level could not be mapped from transcript evidence.",
    ]);
    // Next step is derived from what is actually pending, never from LLM prose.
    expect(payload.recommendedNextStep).toContain("CV");
    expect(payload.recommendedNextStep).not.toContain("clearer transcript evidence");
    // Confidence is the minimum over the fields the verdict consumed (0.88 level field).
    expect(payload.confidence).toBe(0.88);
  });

  it("derives missing-information bullets and next step only from unknown transcript checks", async () => {
    process.env.ELIGIBILITY_SERVICE_URL = "https://eligibility.example.com/evaluate";
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          confidence: 0.7,
          outcome: "eligible",
          missingInformation: ["Some LLM observation."],
          academicPerformance: {},
          applicantDetails: {},
          studyDetails: {
            completionStatus: {
              confidence: 0.9,
              missingOrAmbiguous: false,
              normalizedValue: "completed",
              originalValue: "completed",
            },
          },
          englishLanguageEvidence: {},
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const requirements = [
      {
        id: "completion",
        kind: "qualification_completed",
        params: {},
        sourceText: "Completed bachelor degree.",
        weight: "mandatory",
      },
      {
        id: "wam-65",
        kind: "academic_threshold",
        params: { metric: "wam", min: 65 },
        sourceText: "WAM 65% or above.",
        weight: "mandatory",
      },
    ];

    const formData = new FormData();
    formData.append("file", new File(["fixture"], "no-wam.txt", { type: "text/plain" }));
    formData.append("context", JSON.stringify({ requirements }));

    const response = await eligibilityRoute.fetch(
      new Request("https://example.test/api/evaluate-transcript-eligibility", {
        method: "POST",
        body: formData,
      }),
    );
    const payload = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(payload.outcome).toBe("insufficient_data");
    expect(payload.manualReviewRequired).toBe(true);
    // Exactly one bullet, derived from the unknown academic-threshold check's reason code.
    expect(payload.missingInformation).toEqual([
      "A WAM or GPA could not be found on the transcript.",
    ]);
    expect(payload.recommendedNextStep).toContain("WAM or GPA");
    expect(payload.extractionNotes).toEqual(["Some LLM observation."]);
  });

  it("passes English proficiency via an AHPRA registration carried in the context", async () => {
    process.env.ELIGIBILITY_SERVICE_URL = "https://eligibility.example.com/evaluate";
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          confidence: 0.85,
          manualReviewRequired: false,
          missingInformation: [],
          outcome: "eligible",
          recommendedNextStep: "Proceed",
          academicPerformance: {},
          applicantDetails: {
            countryOfInstitution: {
              confidence: 0.9,
              missingOrAmbiguous: false,
              normalizedValue: "Indonesia",
              originalValue: "Indonesia",
            },
          },
          englishLanguageEvidence: {},
          studyDetails: {
            completionStatus: {
              confidence: 0.9,
              missingOrAmbiguous: false,
              normalizedValue: "completed",
              originalValue: "completed",
            },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const requirements = [
      {
        id: "english",
        kind: "english_proficiency",
        params: { acceptedPathways: [{ type: "completion_in_country", countries: ["AU"] }] },
        sourceText: "Evidence of English language proficiency.",
        weight: "mandatory",
      },
    ];

    const formData = new FormData();
    formData.append("file", new File(["fixture"], "ahpra-english.txt", { type: "text/plain" }));
    // The AHPRA flag must survive the route's context parsing to reach the evaluator.
    formData.append(
      "context",
      JSON.stringify({ hasAhpraRegistration: true, requirements }),
    );

    const response = await eligibilityRoute.fetch(
      new Request("https://example.test/api/evaluate-transcript-eligibility", {
        method: "POST",
        body: formData,
      }),
    );
    const payload = await parseJsonResponse(response);
    const englishCheck = (payload.requirementsChecked as Array<Record<string, unknown>>).find(
      (check) => check.id === "english",
    );

    expect(response.status).toBe(200);
    expect(englishCheck?.status).toBe("pass");
    expect(englishCheck?.reasonCode).toBe("ENGLISH_OK_AHPRA");
  });
});
