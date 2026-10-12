import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkExperienceInputFingerprint } from "@johncarroll/eligibility-rules";
import route from "./evaluate-work-experience";
import { getCourseCatalogFor } from "../src/lib/courseCatalog";
import { MAX_WORK_REQUEST_BYTES, parseWorkInput, readWorkBody } from "./_shared/workExperienceInput";

const auth = vi.hoisted(() => ({ kind: "authenticated", userId: "", sequence: 0 }));
vi.mock("./_documentParser/auth.js", () => ({
  authenticateRequest: async () => ({ kind: auth.kind, userId: auth.userId || `user-${++auth.sequence}` }),
  getClientIp: () => `ip-${++auth.sequence}`,
  isDeployedEnvironment: () => false,
}));

function input() {
  return {
    requirements: [{ id: "work-3", kind: "work_experience", weight: "mandatory", sourceText: "Three years experience",
      pathwayBundleId: "path-a", alternativeGroupId: "alt-a",
      params: { minYears: 3, relevantTo: "Education", qualifyingRoleCriteria: { description: "Leading a team", minYears: 1 } } }],
    roles: [{ id: "role-1", position: "Teacher", duties: "Led a team", startMonth: "January", startYear: "2021",
      endMonth: "December", endYear: "2024", currentRole: false }],
  };
}
function post(body: unknown, headers?: Record<string, string>) {
  return route.fetch(new Request("http://localhost/api/evaluate-work-experience", {
    method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body),
  }));
}

const provider = vi.fn();
beforeEach(() => {
  auth.kind = "authenticated";
  auth.userId = "";
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.stubEnv("SUPABASE_URL", "https://quota.example.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "server-test-key");
  provider.mockReset().mockImplementation(async (url: string) => {
    if (String(url).includes("reserve_work_experience_quota")) return Response.json(true);
    return Response.json({ output_parsed: { assessments: [] } });
  });
  vi.stubGlobal("fetch", provider);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("work assessment resource boundary", () => {
  it("accepts every current catalogue work requirement without changing metadata", () => {
    let count = 0;
    for (const catalog of ["default", "uc"] as const) {
      for (const course of getCourseCatalogFor(catalog)) {
        for (const requirement of course.requirements ?? []) {
          if (requirement.kind !== "work_experience") continue;
          expect(parseWorkInput({ requirements: [requirement], roles: [] }).requirements[0]).toEqual(requirement);
          count++;
        }
      }
    }
    expect(count).toBeGreaterThan(0);
  });
  it.each([
    ["source text", (b: ReturnType<typeof input>) => { b.requirements[0].sourceText = "x".repeat(5001); }],
    ["id", (b: ReturnType<typeof input>) => { b.requirements[0].id = "x".repeat(257); }],
    ["negative years", (b: ReturnType<typeof input>) => { b.requirements[0].params.minYears = -1; }],
    ["large years", (b: ReturnType<typeof input>) => { b.requirements[0].params.minYears = 101; }],
    ["role criteria", (b: ReturnType<typeof input>) => { b.requirements[0].params.qualifyingRoleCriteria.description = "x".repeat(5001); }],
    ["role text", (b: ReturnType<typeof input>) => { b.roles[0].duties = "x".repeat(5001); }],
    ["excess requirements", (b: ReturnType<typeof input>) => { b.requirements = Array.from({ length: 13 }, (_, i) => ({ ...b.requirements[0], id: String(i) })); }],
    ["excess roles", (b: ReturnType<typeof input>) => { b.roles = Array.from({ length: 31 }, (_, i) => ({ ...b.roles[0], id: String(i) })); }],
    ["duplicate IDs", (b: ReturnType<typeof input>) => { b.roles.push(b.roles[0]); }],
  ])("rejects %s before any quota/provider request", async (_, mutate) => {
    const body = input(); mutate(body);
    expect((await post(body)).status).toBe(400);
    expect(provider).not.toHaveBeenCalled();
  });

  it("rejects undeclared nested state and array-shaped params", async () => {
    for (const params of [{ minYears: 3, extra: { deep: { value: "x" } } }, [3],
      { minYears: 3, qualifyingRoleCriteria: { description: "Lead", nested: [] } }]) {
      const b = input();
      Object.assign(b.requirements[0], { params });
      expect((await post(b)).status).toBe(400);
    }
    expect(provider).not.toHaveBeenCalled();
    expect(() => parseWorkInput({ ...input(), requirements: [{ ...input().requirements[0], params: { minYears: Infinity } }] })).toThrow();
    expect(() => parseWorkInput({ ...input(), requirements: [{ ...input().requirements[0], weight: ["mandatory"] }] })).toThrow();
  });

  it("counts UTF-8 bytes in the aggregate model input", async () => {
    const b = input();
    b.roles = Array.from({ length: 12 }, (_, i) => ({ ...b.roles[0], id: String(i), position: "界".repeat(5000), duties: "界".repeat(5000) }));
    expect((await post(b)).status).toBe(400);
    expect(provider).not.toHaveBeenCalled();
  });

  it.each([undefined, "1"])("bounds streamed bodies even with content-length=%s", async (length) => {
    const stream = new ReadableStream<Uint8Array>({ start(controller) {
      controller.enqueue(new Uint8Array(MAX_WORK_REQUEST_BYTES));
      controller.enqueue(new Uint8Array(1)); controller.close();
    } });
    const request = new Request("http://localhost", { method: "POST", body: stream,
      headers: length ? { "content-length": length } : {}, duplex: "half" } as RequestInit);
    await expect(readWorkBody(request)).rejects.toThrow();
  });

  it("rejects oversized declared content length before reading", async () => {
    expect((await post(input(), { "content-length": String(MAX_WORK_REQUEST_BYTES + 1) })).status).toBe(400);
    expect(provider).not.toHaveBeenCalled();
  });

  it("bounds a stalled body read", async () => {
    vi.useFakeTimers();
    const request = new Request("http://localhost", { method: "POST", body: new ReadableStream(), duplex: "half" } as RequestInit);
    const result = expect(readWorkBody(request)).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(10_000);
    await result;
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([false, "invalid", null])("fails closed on quota result %s", async (result) => {
    provider.mockResolvedValue(Response.json(result));
    expect((await post(input())).status).toBe(result === false ? 429 : 503);
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it("fails closed on missing quota credentials and network errors", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect((await post(input())).status).toBe(503);
    expect(provider).not.toHaveBeenCalled();
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-key");
    provider.mockRejectedValue(new Error("offline"));
    expect((await post(input())).status).toBe(503);
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it("rejects open local mode when a paid provider is configured", async () => {
    auth.kind = "open";
    expect((await post(input())).status).toBe(401);
    expect(provider).not.toHaveBeenCalled();
  });

  it("keeps catalogue metadata and successful assessment fingerprints intact", async () => {
    const b = input();
    const response = await post(b);
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.source).toBe("openai");
    expect(payload.assessments[0].inputFingerprint).toBe(createWorkExperienceInputFingerprint({
      asOfMonth: payload.assessments[0].checkedAt.slice(0, 7), requirement: b.requirements[0], roles: b.roles,
    }));
    expect(provider.mock.calls[0][1].body).toMatch(/p_user_id/);
    expect(provider.mock.calls[1][1].signal).toBe(provider.mock.calls[0][1].signal);
  });

  it("returns advisory fallback at the provider deadline and clears its timer", async () => {
    vi.useFakeTimers();
    provider.mockImplementation(async (url: string, init: RequestInit) => {
      if (String(url).includes("reserve_work_experience_quota")) return Response.json(true);
      return new Promise((_, reject) => init.signal!.addEventListener("abort", () => reject(new Error("aborted")), { once: true }));
    });
    const response = post(input());
    await vi.advanceTimersByTimeAsync(45_000);
    expect((await (await response).json()).source).toBe("fallback");
    expect(vi.getTimerCount()).toBe(0);
  });
});
