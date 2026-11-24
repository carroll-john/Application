import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleAdvisorChatSessionRequest } from "./advisor-chat-session";

const AGENT_ID = "agent_test";

function post(ip = "203.0.113.1") {
  return new Request("https://app.test/api/advisor-chat-session", {
    method: "POST",
    headers: { "x-forwarded-for": ip },
  });
}

describe("advisor chat session API", () => {
  beforeEach(() => {
    vi.stubEnv("ELEVENLABS_API_KEY", "test-key");
    vi.stubEnv("ELEVENLABS_AGENT_ID", AGENT_ID);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns a signed URL for the configured agent", async () => {
    const getSignedUrl = vi.fn().mockResolvedValue("wss://api.elevenlabs.io/v1/convai/conversation?x=1");
    const response = await handleAdvisorChatSessionRequest(post("203.0.113.10"), { getSignedUrl });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      signedUrl: "wss://api.elevenlabs.io/v1/convai/conversation?x=1",
    });
    expect(getSignedUrl).toHaveBeenCalledWith(AGENT_ID);
  });

  it("never returns the API key", async () => {
    const response = await handleAdvisorChatSessionRequest(post("203.0.113.11"), {
      getSignedUrl: async () => "wss://api.elevenlabs.io/x",
    });
    expect(await response.text()).not.toContain("test-key");
  });

  it("rejects non-POST requests", async () => {
    const response = await handleAdvisorChatSessionRequest(
      new Request("https://app.test/api/advisor-chat-session"),
    );
    expect(response.status).toBe(405);
  });

  it("reports not configured when the agent id is missing", async () => {
    vi.stubEnv("ELEVENLABS_AGENT_ID", "");
    const response = await handleAdvisorChatSessionRequest(post("203.0.113.12"));
    expect(response.status).toBe(503);
  });

  it("rate limits repeated requests from one client", async () => {
    const getSignedUrl = async () => "wss://api.elevenlabs.io/x";
    const statuses: number[] = [];
    for (let i = 0; i < 11; i += 1) {
      statuses.push((await handleAdvisorChatSessionRequest(post("203.0.113.99"), { getSignedUrl })).status);
    }
    expect(statuses.slice(0, 10).every((status) => status === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});
