import type { LlmTokenUsage } from "./types.js";

/** Pure parsing of the OpenAI Responses-API payload: usage, structured output, truncation. */

export function readUsage(payload: unknown): LlmTokenUsage {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const usage = (payload as Record<string, unknown>).usage;

  if (!usage || typeof usage !== "object") {
    return {};
  }

  const usageRecord = usage as Record<string, unknown>;
  const inputTokens =
    typeof usageRecord.input_tokens === "number"
      ? usageRecord.input_tokens
      : typeof usageRecord.prompt_tokens === "number"
        ? usageRecord.prompt_tokens
        : undefined;
  const outputTokens =
    typeof usageRecord.output_tokens === "number"
      ? usageRecord.output_tokens
      : typeof usageRecord.completion_tokens === "number"
        ? usageRecord.completion_tokens
        : undefined;
  const totalTokens =
    typeof usageRecord.total_tokens === "number"
      ? usageRecord.total_tokens
      : undefined;

  return { inputTokens, outputTokens, totalTokens };
}

function tryParseJsonText(candidate: string) {
  const trimmed = candidate.trim();

  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    // continue to next strategy
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);

  if (fencedMatch?.[1]) {
    try {
      return JSON.parse(fencedMatch[1].trim());
    } catch {
      // continue
    }
  }

  const firstObjectStart = trimmed.indexOf("{");
  const lastObjectEnd = trimmed.lastIndexOf("}");

  if (firstObjectStart >= 0 && lastObjectEnd > firstObjectStart) {
    try {
      return JSON.parse(trimmed.slice(firstObjectStart, lastObjectEnd + 1));
    } catch {
      // continue
    }
  }

  const firstArrayStart = trimmed.indexOf("[");
  const lastArrayEnd = trimmed.lastIndexOf("]");

  if (firstArrayStart >= 0 && lastArrayEnd > firstArrayStart) {
    try {
      return JSON.parse(trimmed.slice(firstArrayStart, lastArrayEnd + 1));
    } catch {
      return null;
    }
  }

  return null;
}

// Exported for tests; not part of the public callLlm contract.
export function extractStructuredOutput(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const root = payload as Record<string, unknown>;

  if (root.output_parsed && typeof root.output_parsed === "object") {
    return root.output_parsed;
  }

  const textCandidates: string[] = [];

  if (typeof root.output_text === "string" && root.output_text.trim()) {
    textCandidates.push(root.output_text);
  }

  const nestedResponse = root.response;
  if (
    nestedResponse &&
    typeof nestedResponse === "object" &&
    typeof (nestedResponse as Record<string, unknown>).output_text === "string"
  ) {
    const nestedText = (nestedResponse as Record<string, unknown>).output_text as string;
    if (nestedText.trim()) {
      textCandidates.push(nestedText);
    }
  }

  if (Array.isArray(root.output)) {
    for (const item of root.output as unknown[]) {
      if (
        !item ||
        typeof item !== "object" ||
        (item as Record<string, unknown>).type !== "message"
      ) {
        continue;
      }

      const content = (item as Record<string, unknown>).content;

      if (!Array.isArray(content)) {
        continue;
      }

      for (const contentItem of content as unknown[]) {
        if (!contentItem || typeof contentItem !== "object") {
          continue;
        }

        const record = contentItem as Record<string, unknown>;

        if (record.parsed && typeof record.parsed === "object") {
          return record.parsed;
        }

        if (record.json && typeof record.json === "object") {
          return record.json;
        }

        if (
          (record.type === "output_text" || record.type === "text") &&
          typeof record.text === "string" &&
          record.text.trim()
        ) {
          textCandidates.push(record.text);
        }
      }
    }
  }

  for (const candidate of textCandidates) {
    const parsed = tryParseJsonText(candidate);

    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  }

  return null;
}

export function isMaxTokensTruncation(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const record = payload as Record<string, unknown>;

  if (record.status !== "incomplete") {
    return false;
  }

  const incomplete = record.incomplete_details;

  return (
    incomplete !== null &&
    typeof incomplete === "object" &&
    (incomplete as Record<string, unknown>).reason === "max_output_tokens"
  );
}
