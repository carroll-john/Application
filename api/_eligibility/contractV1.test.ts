import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import eligibilityRoute from "../evaluate-transcript-eligibility";
import {
  ELIGIBILITY_AUTH_SCHEME,
  ELIGIBILITY_CONTRACT_VERSION,
  ELIGIBILITY_EVIDENCE_GROUPS,
  ELIGIBILITY_OUTCOMES,
  ELIGIBILITY_REQUEST_PARTS,
  ELIGIBILITY_RESPONSE_REQUIRED_FIELDS_V1,
  isEligibilityOutcome,
} from "./contractV1";

/**
 * Conformance test for the eligibility-evaluate v1 contract.
 * Guards the HTTP boundary against drift now that the service lives in a separate repo
 * (github.com/carroll-john/eligibility-service). Prose: docs/contracts/eligibility-evaluate.v1.md
 */

const SERVICE_URL = "https://eligibility.example.com/api/evaluate";
const SERVICE_TOKEN = "contract-token";

const originalFetch = globalThis.fetch;
const fetchMock = vi.fn();

/** A complete, contract-valid v1 service response. */
function makeV1ServicePayload(): Record<string, unknown> {
  const extractedField = (value: string | null) => ({
    confidence: value ? 0.9 : 0.2,
    missingOrAmbiguous: value === null,
    normalizedValue: value,
    originalValue: value,
  });
  const applicantDetails = {
    countryOfInstitution: extractedField("Australia"),
    fullName: extractedField("Jane Doe"),
    institutionName: extractedField("Example University"),
    studentId: extractedField("S1234567"),
  };
  const studyDetails = {
    completionDate: extractedField("2024-11-30"),
    completionStatus: extractedField("completed"),
    expectedCompletionDate: extractedField(null),
    highestEducationLevel: extractedField("bachelor"),
    languageOfInstruction: extractedField("English"),
    programName: extractedField("Bachelor of Science"),
    startDate: extractedField("2021-02-01"),
  };
  const academicPerformance = {
    creditPointsCompleted: extractedField("144"),
    failedSubjects: extractedField(null),
    gpa: extractedField("6.2"),
    gpaScale: extractedField("7"),
    gradeAverageOrWam: extractedField("78"),
    gradingNotes: extractedField(null),
  };
  const englishLanguageEvidence = {
    englishCountryEvidence: extractedField("Australia"),
    englishInstructionEvidence: extractedField("English"),
    englishRequirementSatisfaction: extractedField("met"),
    uncertainty: extractedField(null),
  };

  return {
    academicPerformance,
    applicantDetails,
    checkedAt: "2026-06-03T00:00:00.000Z",
    confidence: 0.92,
    englishLanguageEvidence,
    manualReviewRequired: false,
    missingInformation: [],
    outcome: "eligible",
    programCode: "MDA900",
    programTitle: "Master of Data Analytics",
    recommendedNextStep: "Proceed with application submission and admissions verification.",
    rulesVersion: "v1",
    serviceVersion: "v1",
    studyDetails,
  };
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
  delete process.env.POSTHOG_PROJECT_API_KEY;
  delete process.env.POSTHOG_HOST;
  delete process.env.VITE_POSTHOG_HOST;
});

async function postTranscript(contextJson: string) {
  const formData = new FormData();
  formData.append("file", new File(["transcript fixture"], "transcript.txt", { type: "text/plain" }));
  formData.append("context", contextJson);
  return eligibilityRoute.fetch(
    new Request("https://example.test/api/evaluate-transcript-eligibility", {
      method: "POST",
      body: formData,
    }),
  );
}

describe("eligibility-evaluate contract v1", () => {
  it("is pinned at version v1", () => {
    expect(ELIGIBILITY_CONTRACT_VERSION).toBe("v1");
  });

  it("the canonical v1 payload includes every contract-required field", () => {
    const payload = makeV1ServicePayload();
    for (const field of ELIGIBILITY_RESPONSE_REQUIRED_FIELDS_V1) {
      expect(payload, `missing required v1 field: ${field}`).toHaveProperty(field);
    }
    expect(isEligibilityOutcome(payload.outcome)).toBe(true);
  });

  it("REQUEST: proxy sends exactly the v1 multipart parts and bearer auth to the service URL", async () => {
    process.env.ELIGIBILITY_SERVICE_URL = SERVICE_URL;
    process.env.ELIGIBILITY_SERVICE_TOKEN = SERVICE_TOKEN;
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(makeV1ServicePayload()), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const response = await postTranscript(
      JSON.stringify({ completed: true, courseCode: "MDA900", courseTitle: "Master of Data Analytics" }),
    );
    expect(response.status).toBe(200);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    // URL + method
    expect(url).toBe(SERVICE_URL);
    expect(init.method).toBe("POST");

    // Auth scheme
    expect(init.headers).toBeInstanceOf(Headers);
    expect((init.headers as Headers).get("authorization")).toBe(
      `${ELIGIBILITY_AUTH_SCHEME} ${SERVICE_TOKEN}`,
    );

    // Exactly the v1 parts: file + context, nothing else
    expect(init.body).toBeInstanceOf(FormData);
    const body = init.body as FormData;
    expect([...body.keys()].sort()).toEqual([...ELIGIBILITY_REQUEST_PARTS].sort());

    // context part round-trips as JSON carrying what we sent
    const forwardedContext = JSON.parse(body.get("context") as string) as Record<string, unknown>;
    expect(forwardedContext.courseCode).toBe("MDA900");
  });

  it("RESPONSE: proxy accepts a full v1 payload, preserves evidence groups, and resolves a valid outcome", async () => {
    process.env.ELIGIBILITY_SERVICE_URL = SERVICE_URL;
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(makeV1ServicePayload()), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const response = await postTranscript(JSON.stringify({ completed: true, courseCode: "MDA900" }));
    const payload = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);

    // Outcome is one of the four contract statuses
    expect(isEligibilityOutcome(payload.outcome)).toBe(true);
    expect(ELIGIBILITY_OUTCOMES).toContain(payload.outcome);

    // Every evidence group the service sent survives to the app response (matcher consumes these)
    for (const group of ELIGIBILITY_EVIDENCE_GROUPS) {
      expect(payload, `evidence group dropped: ${group}`).toHaveProperty(group);
    }

    // App always emits a requirements verdict list and preserves program identity
    expect(Array.isArray(payload.requirementsChecked)).toBe(true);
    expect(payload.programCode).toBe("MDA900");
  });

  it("RESPONSE: a non-OK service response is re-wrapped as the typed upstream error", async () => {
    process.env.ELIGIBILITY_SERVICE_URL = SERVICE_URL;
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "boom" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      }),
    );

    const response = await postTranscript(JSON.stringify({ courseCode: "MDA900" }));
    const payload = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(503);
    expect(payload.code).toBe("ELIGIBILITY_SERVICE_UPSTREAM_ERROR");
  });
});
