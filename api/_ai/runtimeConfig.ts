export const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
export const VERCEL_AI_GATEWAY_RESPONSES_URL =
  "https://ai-gateway.vercel.sh/v1/responses";

export interface LlmRuntimeConfig {
  apiKey: string;
  responsesUrl: string;
  source: "openai" | "vercel_ai_gateway";
}

export function resolveLlmRuntimeConfig(
  environment: NodeJS.ProcessEnv = process.env,
): LlmRuntimeConfig | null {
  const openAiKey = environment.OPENAI_API_KEY?.trim();
  if (openAiKey) {
    return {
      apiKey: openAiKey,
      responsesUrl:
        environment.OPENAI_RESPONSES_URL?.trim() || OPENAI_RESPONSES_URL,
      source: "openai",
    };
  }

  const gatewayKey =
    environment.AI_GATEWAY_API_KEY?.trim() ||
    environment.VERCEL_OIDC_TOKEN?.trim();
  if (!gatewayKey) return null;

  return {
    apiKey: gatewayKey,
    responsesUrl: VERCEL_AI_GATEWAY_RESPONSES_URL,
    source: "vercel_ai_gateway",
  };
}

export function resolveLlmModel(model: string, config: LlmRuntimeConfig) {
  const normalizedModel = model.trim();
  if (
    config.source === "vercel_ai_gateway" &&
    normalizedModel &&
    !normalizedModel.includes("/")
  ) {
    return `openai/${normalizedModel}`;
  }

  return normalizedModel;
}
