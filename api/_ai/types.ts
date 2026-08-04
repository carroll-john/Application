/** Shared types for the LLM client and its OpenAI Responses-API adapter. */

export type LlmContent =
  | { kind: "text"; text: string }
  | { kind: "file"; filename: string; mimeType: string; data: ArrayBuffer };

export type LlmPrompt = {
  id: string;
  version: number;
  instructions: string;
  userPrompt: string;
};

export type LlmSchema = {
  id: string;
  version: number;
  jsonSchema: object;
};

export type LlmTraceOptions = {
  enabled: boolean;
  agentName: string;
  recordInputs: boolean;
  recordOutputs: boolean;
  agentSpanAttributes?: Record<string, string | number | boolean>;
};

export type LlmRequest = {
  provider: "openai";
  apiKey: string;
  responsesUrl: string;
  model: string;
  prompt: LlmPrompt;
  schema: LlmSchema;
  attachments: LlmContent[];
  initialMaxOutputTokens: number;
  retryMaxOutputTokens: number;
  enableCodeInterpreter?: boolean;
  trace: LlmTraceOptions;
};

export type LlmTokenUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type LlmUpstreamSnapshot = {
  ok: boolean;
  status: number;
  statusText: string;
  payload: unknown;
};

interface LlmResultBase {
  tokens: LlmTokenUsage;
  latencyMs: number;
  attempts: number;
  upstream: LlmUpstreamSnapshot;
}

// Discriminated union: `parsed` is only readable when status === "ok",
// so callers can't accidentally consume a stale or missing payload.
export type LlmResult =
  | (LlmResultBase & { status: "ok"; parsed: unknown })
  | (LlmResultBase & { status: "truncated" })
  | (LlmResultBase & { status: "invalid_response" })
  | (LlmResultBase & { status: "upstream_error" });

export type OpenAiContent =
  | { type: "input_text"; text: string }
  | { type: "input_file"; filename: string; file_data: string };

export type OpenAiRequestTraceMeta = {
  attempt: number;
  hasFileInput: boolean;
  inputItemCount: number;
  model: string;
  agentName: string;
  recordInputs: boolean;
  recordOutputs: boolean;
};
