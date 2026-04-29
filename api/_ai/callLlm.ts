import * as Sentry from "@sentry/node";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const MAX_AI_ATTRIBUTE_CHARS = 4_000;

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

export type LlmResult = {
  status: "ok" | "truncated" | "invalid_response" | "upstream_error";
  parsed?: unknown;
  tokens: LlmTokenUsage;
  latencyMs: number;
  attempts: number;
  upstream: LlmUpstreamSnapshot;
};

type OpenAiContent =
  | { type: "input_text"; text: string }
  | { type: "input_file"; filename: string; file_data: string };

type OpenAiRequestTraceMeta = {
  attempt: number;
  hasFileInput: boolean;
  inputItemCount: number;
  model: string;
  agentName: string;
  recordInputs: boolean;
  recordOutputs: boolean;
};

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const slice = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...slice);
  }

  return Buffer.from(binary, "binary").toString("base64");
}

function toOpenAiContent(content: LlmContent): OpenAiContent {
  if (content.kind === "text") {
    return { type: "input_text", text: content.text };
  }

  return {
    type: "input_file",
    filename: content.filename,
    file_data: `data:${content.mimeType};base64,${arrayBufferToBase64(content.data)}`,
  };
}

function buildOpenAiRequestBody(
  request: LlmRequest,
  inputContent: OpenAiContent[],
  maxOutputTokens: number,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    max_output_tokens: maxOutputTokens,
    model: request.model,
    instructions: request.prompt.instructions,
    input: [
      {
        role: "user",
        content: inputContent,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: request.schema.id,
        strict: true,
        schema: request.schema.jsonSchema,
      },
    },
  };

  if (request.enableCodeInterpreter) {
    body.tools = [{ type: "code_interpreter", container: { type: "auto" } }];
    body.tool_choice = "auto";
  }

  return body;
}

function truncateSpanText(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  return trimmed.length > MAX_AI_ATTRIBUTE_CHARS
    ? `${trimmed.slice(0, MAX_AI_ATTRIBUTE_CHARS)}…`
    : trimmed;
}

function setStringSpanAttribute(span: Sentry.Span, key: string, value: unknown) {
  if (typeof value === "string" && value.trim()) {
    span.setAttribute(key, value.trim());
  }
}

function setNumberSpanAttribute(span: Sentry.Span, key: string, value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    span.setAttribute(key, value);
  }
}

function readUsage(payload: unknown): LlmTokenUsage {
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

function setOpenAiUsageAttributes(span: Sentry.Span, payload: unknown) {
  const usage = readUsage(payload);
  setNumberSpanAttribute(span, "gen_ai.usage.input_tokens", usage.inputTokens);
  setNumberSpanAttribute(span, "gen_ai.usage.output_tokens", usage.outputTokens);
  setNumberSpanAttribute(span, "gen_ai.usage.total_tokens", usage.totalTokens);
}

function buildOpenAiRequestAttributes(meta: OpenAiRequestTraceMeta) {
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

async function executeOpenAiRequest(
  apiKey: string,
  requestBody: Record<string, unknown>,
  meta: OpenAiRequestTraceMeta,
  tracingEnabled: boolean,
) {
  const issue = async (span?: Sentry.Span) => {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const payload = await response.json().catch(() => null);

    if (span) {
      Sentry.setHttpStatus(span, response.status);
      setOpenAiUsageAttributes(span, payload);

      if (payload && typeof payload === "object") {
        const payloadRecord = payload as Record<string, unknown>;
        setStringSpanAttribute(span, "gen_ai.response.id", payloadRecord.id);
        setStringSpanAttribute(span, "gen_ai.response.model", payloadRecord.model);
        setStringSpanAttribute(span, "openai.response.status", payloadRecord.status);

        if (meta.recordOutputs && typeof payloadRecord.output_text === "string") {
          const outputText = truncateSpanText(payloadRecord.output_text);

          if (outputText) {
            span.setAttribute("gen_ai.response.text", outputText);
          }
        }

        if (payloadRecord.error && typeof payloadRecord.error === "object") {
          const errorRecord = payloadRecord.error as Record<string, unknown>;
          setStringSpanAttribute(span, "openai.error.type", errorRecord.type);
          setStringSpanAttribute(span, "openai.error.message", errorRecord.message);

          if (typeof errorRecord.code === "string" || typeof errorRecord.code === "number") {
            span.setAttribute("openai.error.code", String(errorRecord.code));
          }
        }
      }
    }

    return { payload, response };
  };

  if (!tracingEnabled) {
    return issue();
  }

  return Sentry.startSpan(
    {
      name:
        meta.attempt > 1
          ? `OpenAI Responses API attempt ${meta.attempt}`
          : "OpenAI Responses API",
      op: "gen_ai.response",
      attributes: buildOpenAiRequestAttributes(meta),
    },
    async (span) => {
      if (meta.recordInputs) {
        const requestInput = (requestBody as Record<string, unknown>).input;
        const inputText = truncateSpanText(JSON.stringify(requestInput ?? []));

        if (inputText) {
          span.setAttribute("gen_ai.input.messages", inputText);
        }
      }

      return issue(span);
    },
  );
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

function extractStructuredOutput(payload: unknown) {
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

function isMaxTokensTruncation(payload: unknown) {
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

async function callOpenAi(request: LlmRequest): Promise<LlmResult> {
  const inputContent: OpenAiContent[] = [
    { type: "input_text", text: request.prompt.userPrompt },
    ...request.attachments.map(toOpenAiContent),
  ];
  const hasFileInput = inputContent.some((item) => item.type === "input_file");

  const initialBody = buildOpenAiRequestBody(
    request,
    inputContent,
    request.initialMaxOutputTokens,
  );

  const baseMeta: Omit<OpenAiRequestTraceMeta, "attempt"> = {
    hasFileInput,
    inputItemCount: inputContent.length,
    model: request.model,
    agentName: request.trace.agentName,
    recordInputs: request.trace.recordInputs,
    recordOutputs: request.trace.recordOutputs,
  };

  const startedAt = Date.now();

  const run = async () => {
    let attempts = 1;
    let result = await executeOpenAiRequest(
      request.apiKey,
      initialBody,
      { ...baseMeta, attempt: 1 },
      request.trace.enabled,
    );

    if (result.response.ok && isMaxTokensTruncation(result.payload)) {
      attempts = 2;
      result = await executeOpenAiRequest(
        request.apiKey,
        { ...initialBody, max_output_tokens: request.retryMaxOutputTokens },
        { ...baseMeta, attempt: 2 },
        request.trace.enabled,
      );
    }

    return { result, attempts };
  };

  const { result, attempts } = request.trace.enabled
    ? await Sentry.startSpan(
        {
          name: "CV parser agent",
          op: "gen_ai.invoke_agent",
          forceTransaction: true,
          attributes: {
            "gen_ai.agent.name": request.trace.agentName,
            "gen_ai.operation.name": "parse_cv_employment_history",
            "gen_ai.request.model": request.model,
            "gen_ai.system": "openai",
            ...(request.trace.agentSpanAttributes ?? {}),
          },
        },
        run,
      )
    : await run();

  const latencyMs = Date.now() - startedAt;
  const tokens = readUsage(result.payload);
  const upstream: LlmUpstreamSnapshot = {
    ok: result.response.ok,
    status: result.response.status,
    statusText: result.response.statusText,
    payload: result.payload,
  };

  if (!result.response.ok) {
    return { status: "upstream_error", tokens, latencyMs, attempts, upstream };
  }

  if (isMaxTokensTruncation(result.payload)) {
    return { status: "truncated", tokens, latencyMs, attempts, upstream };
  }

  const parsed = extractStructuredOutput(result.payload);

  if (!parsed) {
    return { status: "invalid_response", tokens, latencyMs, attempts, upstream };
  }

  return { status: "ok", parsed, tokens, latencyMs, attempts, upstream };
}

export async function callLlm(request: LlmRequest): Promise<LlmResult> {
  switch (request.provider) {
    case "openai":
      return callOpenAi(request);
    default: {
      const exhaustive: never = request.provider;
      throw new Error(`Unsupported LLM provider: ${String(exhaustive)}`);
    }
  }
}
