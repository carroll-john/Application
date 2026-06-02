import * as Sentry from "@sentry/node";

import { readUsage } from "./openaiResponse.js";
import type { OpenAiRequestTraceMeta } from "./types.js";

/** Sentry span attribute helpers for OpenAI Agent Insights tracing. */

const MAX_AI_ATTRIBUTE_CHARS = 4_000;

export function truncateSpanText(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  return trimmed.length > MAX_AI_ATTRIBUTE_CHARS
    ? `${trimmed.slice(0, MAX_AI_ATTRIBUTE_CHARS)}…`
    : trimmed;
}

export function setStringSpanAttribute(span: Sentry.Span, key: string, value: unknown) {
  if (typeof value === "string" && value.trim()) {
    span.setAttribute(key, value.trim());
  }
}

export function setNumberSpanAttribute(span: Sentry.Span, key: string, value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    span.setAttribute(key, value);
  }
}

export function setOpenAiUsageAttributes(span: Sentry.Span, payload: unknown) {
  const usage = readUsage(payload);
  setNumberSpanAttribute(span, "gen_ai.usage.input_tokens", usage.inputTokens);
  setNumberSpanAttribute(span, "gen_ai.usage.output_tokens", usage.outputTokens);
  setNumberSpanAttribute(span, "gen_ai.usage.total_tokens", usage.totalTokens);
}

export function buildOpenAiRequestAttributes(meta: OpenAiRequestTraceMeta) {
  return {
    "gen_ai.agent.name": meta.agentName,
    "gen_ai.operation.name": "responses.create",
    "gen_ai.request.model": meta.model,
    "gen_ai.system": "openai",
    "openai.request.attempt": meta.attempt,
    "openai.request.has_file_input": meta.hasFileInput,
    "openai.request.input_item_count": meta.inputItemCount,
  };
}
