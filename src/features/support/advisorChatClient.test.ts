import { describe, expect, it, vi } from "vitest";
import { requestAdvisorChatSignedUrl } from "./advisorChatClient";

const respond = (body: unknown, status = 200) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe("requestAdvisorChatSignedUrl", () => {
  it("POSTs to the app API and returns the signed URL", async () => {
    const fetchImpl = respond({ signedUrl: "wss://api.elevenlabs.io/v1/convai/conversation?t=1" });
    await expect(requestAdvisorChatSignedUrl(fetchImpl)).resolves.toBe(
      "wss://api.elevenlabs.io/v1/convai/conversation?t=1",
    );
    expect(fetchImpl).toHaveBeenCalledWith("/api/advisor-chat-session", { method: "POST" });
  });

  it("throws when the API fails", async () => {
    await expect(requestAdvisorChatSignedUrl(respond({ error: "x" }, 503))).rejects.toThrow();
  });

  it("throws when the response has no websocket URL", async () => {
    await expect(requestAdvisorChatSignedUrl(respond({ signedUrl: "http://bad" }))).rejects.toThrow();
  });
});

describe("ADVISOR_VOICE_AUDIO_CONFIG", () => {
  it("loads every voice worklet from this origin", async () => {
    const { ADVISOR_VOICE_AUDIO_CONFIG } = await import("./advisorChatClient");
    const paths = [
      ...Object.values(ADVISOR_VOICE_AUDIO_CONFIG.workletPaths),
      ADVISOR_VOICE_AUDIO_CONFIG.libsampleratePath,
    ];
    expect(paths).toHaveLength(3);
    for (const path of paths) expect(path).toMatch(/^\/elevenlabs-audio\/[\w.]+\.js$/);
  });
});
