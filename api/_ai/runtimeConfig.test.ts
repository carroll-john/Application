import { describe, expect, it } from "vitest";
import {
  OPENAI_RESPONSES_URL,
  VERCEL_AI_GATEWAY_RESPONSES_URL,
  resolveLlmModel,
  resolveLlmRuntimeConfig,
} from "./runtimeConfig";

describe("LLM runtime configuration", () => {
  it("prefers a direct OpenAI key when configured", () => {
    const config = resolveLlmRuntimeConfig({
      AI_GATEWAY_API_KEY: "gateway-key",
      OPENAI_API_KEY: "openai-key",
    });

    expect(config).toEqual({
      apiKey: "openai-key",
      responsesUrl: OPENAI_RESPONSES_URL,
      source: "openai",
    });
    expect(resolveLlmModel("gpt-4.1-mini", config!)).toBe("gpt-4.1-mini");
  });

  it("uses an AI Gateway key with an OpenAI model namespace", () => {
    const config = resolveLlmRuntimeConfig({
      AI_GATEWAY_API_KEY: "gateway-key",
    });

    expect(config).toEqual({
      apiKey: "gateway-key",
      responsesUrl: VERCEL_AI_GATEWAY_RESPONSES_URL,
      source: "vercel_ai_gateway",
    });
    expect(resolveLlmModel("gpt-4.1-mini", config!)).toBe(
      "openai/gpt-4.1-mini",
    );
  });

  it("uses the project-scoped Vercel OIDC token without duplicating a namespace", () => {
    const config = resolveLlmRuntimeConfig({
      VERCEL_OIDC_TOKEN: "oidc-token",
    });

    expect(config?.source).toBe("vercel_ai_gateway");
    expect(resolveLlmModel("openai/gpt-4.1-mini", config!)).toBe(
      "openai/gpt-4.1-mini",
    );
  });

  it("returns null when no supported server credential is available", () => {
    expect(resolveLlmRuntimeConfig({})).toBeNull();
  });
});
