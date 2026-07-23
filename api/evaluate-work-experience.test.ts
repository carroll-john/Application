import { afterEach, beforeEach, describe, expect, it } from "vitest";
import route, { normalizeWorkExperienceRoleClassification } from "./evaluate-work-experience";

const AUTH_ENV_KEYS = [
  "SUPABASE_ANON_KEY",
  "SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_SUPABASE_URL",
] as const;
const originalEnv = new Map(
  ["OPENAI_API_KEY", ...AUTH_ENV_KEYS].map((key) => [key, process.env[key]]),
);

beforeEach(() => {
  for (const key of AUTH_ENV_KEYS) delete process.env[key];
});

afterEach(() => {
  for (const [key, value] of originalEnv) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function post(body: unknown) {
  return route.fetch(new Request("http://localhost/api/evaluate-work-experience", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }));
}

describe("evaluate-work-experience", () => {
  it("returns advisory needs-review assessments when AI is not configured", async () => {
    delete process.env.OPENAI_API_KEY;
    const response = await post({
      requirements: [{
        id: "work-3", kind: "work_experience", params: { minYears: 3 },
        sourceText: "Three years relevant experience", weight: "mandatory",
      }],
      roles: [{
        id: "role-1", position: "Operations Lead", duties: "Led projects",
        startMonth: "January", startYear: "2021", endMonth: "December",
        endYear: "2023", currentRole: false,
      }],
    });
    expect(response.status).toBe(200);
    const payload = await response.json() as { assessments: Array<{ status: string }> };
    expect(payload.assessments[0]?.status).toBe("needs_review");
  });

  it("rejects requests without a work-experience requirement", async () => {
    const response = await post({ requirements: [], roles: [] });
    expect(response.status).toBe(400);
  });

  it("treats a managerial title without duties as only a possible role-level match", () => {
    expect(normalizeWorkExperienceRoleClassification({
      relevanceStatus: "relevant",
      roleCriteriaStatus: "met",
      confidence: 0.9,
      explanation: "Manager title",
      evidencePhrases: ["Manager"],
    }, {
      id: "role-1", position: "Manager", duties: "Prepared weekly reports.", startMonth: "", startYear: "2022",
      endMonth: "", endYear: "2024", currentRole: false,
    }, true)).toMatchObject({
      relevanceStatus: "possibly_relevant",
      roleCriteriaStatus: "possibly_met",
    });
  });

  it("allows explicit people-management duties to support a non-manager title", () => {
    expect(normalizeWorkExperienceRoleClassification({
      relevanceStatus: "relevant",
      roleCriteriaStatus: "met",
      confidence: 0.92,
      explanation: "The duties explicitly show people leadership.",
      evidencePhrases: ["Managed a team of six"],
    }, {
      id: "role-1", position: "Senior Analyst", duties: "Managed a team of six analysts.",
      startMonth: "January", startYear: "2022", endMonth: "December", endYear: "2024",
      currentRole: false,
    }, true)).toMatchObject({
      relevanceStatus: "relevant",
      roleCriteriaStatus: "met",
      evidencePhrases: ["Managed a team of six"],
    });
  });
});
