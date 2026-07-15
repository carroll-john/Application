import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
vi.mock("./supabase", () => ({ supabase: { auth: { getSession } } }));

const { requestWorkExperienceAssessment } = await import("./workExperienceAssessmentClient");
const originalFetch = globalThis.fetch;
const fetchMock = vi.fn();

beforeEach(() => {
  globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
  fetchMock.mockReset();
  getSession.mockResolvedValue({ data: { session: { access_token: "token" } } });
});
afterEach(() => { globalThis.fetch = originalFetch });

describe("requestWorkExperienceAssessment", () => {
  it("does not send employer names and forwards bearer auth", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ assessments: [] }), {
      status: 200, headers: { "content-type": "application/json" },
    }));
    await requestWorkExperienceAssessment({
      requirements: [{
        id: "work-1", kind: "work_experience", params: { minYears: 3 },
        sourceText: "Three years relevant experience", weight: "mandatory",
      }],
      roles: [{
        id: "role-1", company: "Private Employer", position: "Manager", type: "Full-time",
        startMonth: "January", startYear: "2020", endMonth: "December", endYear: "2023",
        currentRole: false, duties: "Led a team.",
      }],
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/evaluate-work-experience");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer token");
    expect(init.body).not.toContain("Private Employer");
  });

  it("returns immediately for courses without work requirements", async () => {
    await expect(requestWorkExperienceAssessment({ requirements: [], roles: [] })).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses the local assessment server when the local Vite route is unavailable", async () => {
    vi.stubGlobal("window", { location: { hostname: "localhost" } });
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ assessments: [] }), {
        status: 200, headers: { "content-type": "application/json" },
      }));

    await requestWorkExperienceAssessment({
      requirements: [{
        id: "work-1", kind: "work_experience", params: { minYears: 2 },
        sourceText: "Two years relevant experience", weight: "mandatory",
      }],
      roles: [],
    });

    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "http://127.0.0.1:4190/api/evaluate-work-experience",
    );
    vi.unstubAllGlobals();
  });
});
