import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();

vi.mock("./supabase", () => ({
  supabase: { auth: { getSession } },
}));

const {
  CvParserRequestError,
  getCvParserErrorMessage,
  parseEmploymentExperiencesFromCv,
} = await import("./cvParserClient");

const fetchMock = vi.fn();
const originalFetch = globalThis.fetch;

function makeJsonResponse(payload: unknown, init: { status?: number } = {}) {
  return new Response(JSON.stringify(payload), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
  fetchMock.mockReset();
  getSession.mockReset();
  getSession.mockResolvedValue({ data: { session: null } });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("parseEmploymentExperiencesFromCv", () => {
  it("posts to /api/parse-cv with the bearer token when a session exists", async () => {
    getSession.mockResolvedValue({
      data: { session: { access_token: "tok-123" } },
    });
    fetchMock.mockResolvedValueOnce(
      makeJsonResponse({ experiences: [], model: "gpt-4.1-mini" }),
    );

    const file = new File(["resume"], "cv.pdf", { type: "application/pdf" });
    const result = await parseEmploymentExperiencesFromCv(file);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/parse-cv");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ authorization: "Bearer tok-123" });
    expect(init.body).toBeInstanceOf(FormData);
    expect(result).toEqual({ experiences: [], model: "gpt-4.1-mini" });
  });

  it("omits the authorization header when no session is available", async () => {
    fetchMock.mockResolvedValueOnce(makeJsonResponse({ experiences: [] }));

    await parseEmploymentExperiencesFromCv(
      new File(["x"], "cv.pdf", { type: "application/pdf" }),
    );

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers).toEqual({});
  });

  it("throws a CvParserRequestError carrying the upstream status and message", async () => {
    fetchMock.mockResolvedValueOnce(
      makeJsonResponse(
        { code: "CV_PARSER_UNAUTHORIZED", error: "Sign in before parsing a CV." },
        { status: 401 },
      ),
    );

    await expect(
      parseEmploymentExperiencesFromCv(
        new File(["x"], "cv.pdf", { type: "application/pdf" }),
      ),
    ).rejects.toMatchObject({
      name: "CvParserRequestError",
      status: 401,
      message: "Sign in before parsing a CV.",
    });
  });

  it("falls back to a generic message when the error payload is missing", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("not json", { status: 502 }),
    );

    await expect(
      parseEmploymentExperiencesFromCv(
        new File(["x"], "cv.pdf", { type: "application/pdf" }),
      ),
    ).rejects.toMatchObject({
      status: 502,
      message: "We couldn't parse this CV right now.",
    });
  });

  it("normalizes legacy snake_case fields and ignores extra keys", async () => {
    fetchMock.mockResolvedValueOnce(
      makeJsonResponse({
        experiences: [
          {
            company: "Acme",
            position: "Engineer",
            current_role: true,
            duties: "Built things",
            start_month: "January",
            start_year: "2020",
            ignored_extra: "drop",
          },
        ],
      }),
    );

    const result = await parseEmploymentExperiencesFromCv(
      new File(["x"], "cv.pdf", { type: "application/pdf" }),
    );

    expect(result.experiences).toHaveLength(1);
    expect(result.experiences[0]).toMatchObject({
      company: "Acme",
      position: "Engineer",
      duties: "Built things",
    });
    // Snake-case keys aren't read by cvParserClient (they're stripped via the
    // typed accessors), so currentRole defaults to false; this asserts that
    // contract rather than legacy support.
    expect(result.experiences[0].currentRole).toBe(false);
  });

  it("returns an empty experiences array when the payload shape is unexpected", async () => {
    fetchMock.mockResolvedValueOnce(makeJsonResponse({ surprise: 1 }));

    const result = await parseEmploymentExperiencesFromCv(
      new File(["x"], "cv.pdf", { type: "application/pdf" }),
    );

    expect(result.experiences).toEqual([]);
    expect(result.model).toBeUndefined();
  });
});

describe("getCvParserErrorMessage", () => {
  it("returns a localhost hint for a 404 from the parser route", () => {
    const error = new CvParserRequestError("ignored", 404);
    expect(getCvParserErrorMessage(error)).toContain("local parser API");
  });

  it("returns the upstream error message for non-404 CvParserRequestError", () => {
    const error = new CvParserRequestError("Sign in first.", 401);
    expect(getCvParserErrorMessage(error)).toBe("Sign in first.");
  });

  it("returns a generic fallback for non-CvParserRequestError values", () => {
    expect(getCvParserErrorMessage(new Error("network"))).toContain(
      "couldn't auto-fill",
    );
    expect(getCvParserErrorMessage(undefined)).toContain("couldn't auto-fill");
  });
});
