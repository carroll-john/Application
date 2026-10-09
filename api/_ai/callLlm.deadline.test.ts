import { afterEach, describe, expect, it, vi } from "vitest";
import { callLlm, type LlmRequest } from "./callLlm";

function request(signal: AbortSignal): LlmRequest {
  return { provider: "openai", apiKey: "test", model: "gpt-4.1-mini", signal,
    prompt: { id: "test", version: 1, instructions: "test", userPrompt: "test" },
    schema: { id: "test", version: 1, jsonSchema: {} }, attachments: [],
    initialMaxOutputTokens: 2000, retryMaxOutputTokens: 6000,
    trace: { enabled: false, agentName: "test", recordInputs: false, recordOutputs: false } };
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("shared provider deadline", () => {
  it("shares the remaining deadline with a truncation retry", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 100);
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      if (fetchMock.mock.calls.length === 1) {
        await new Promise((resolve) => setTimeout(resolve, 80));
        return Response.json({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" } });
      }
      return new Promise((_, reject) => init.signal!.addEventListener("abort", () => reject(new Error("deadline")), { once: true }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = expect(callLlm(request(controller.signal))).rejects.toThrow("deadline");
    await vi.advanceTimersByTimeAsync(100);
    await result;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
    expect(fetchMock.mock.calls[1][1].signal).toBe(controller.signal);
    clearTimeout(timeout);
  });

  it("does not start a retry after abort during the first response body", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => {
      controller.abort();
      return { status: "incomplete", incomplete_details: { reason: "max_output_tokens" } };
    } });
    vi.stubGlobal("fetch", fetchMock);
    await expect(callLlm(request(controller.signal))).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not swallow response-body cancellation or call an already aborted provider", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => { controller.abort(); throw new Error("body cancelled"); } });
    vi.stubGlobal("fetch", fetchMock);
    await expect(callLlm(request(controller.signal))).rejects.toThrow();
    await expect(callLlm(request(controller.signal))).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
