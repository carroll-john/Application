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
  delete process.env.POSTHOG_PROJECT_API_KEY;
  delete process.env.POSTHOG_HOST;
  delete process.env.VITE_POSTHOG_HOST;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.ELIGIBILITY_SERVICE_URL;
  delete process.env.ELIGIBILITY_SERVICE_TOKEN;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_TRANSCRIPT_ELIGIBILITY_MODEL;
  delete process.env.POSTHOG_PROJECT_API_KEY;
  delete process.env.POSTHOG_HOST;
  delete process.env.VITE_POSTHOG_HOST;
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
    expect(payload.rulesVersion).toBe("rules-v1");
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
    expect(payload.rulesVersion).toBe("rules-v1");
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

