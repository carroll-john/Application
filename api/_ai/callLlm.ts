import * as Sentry from "@sentry/node";

import { buildOpenAiRequestBody, toOpenAiContent } from "./openaiRequest.js";
import {
  extractStructuredOutput,
  isMaxTokensTruncation,
  readUsage,
} from "./openaiResponse.js";
import {
  buildOpenAiRequestAttributes,
  setOpenAiUsageAttributes,
  setStringSpanAttribute,
  truncateSpanText,
} from "./openaiTracing.js";
import type {
  LlmRequest,
  LlmResult,
  LlmUpstreamSnapshot,
  OpenAiContent,
  OpenAiRequestTraceMeta,
} from "./types.js";

// Public LLM contract types.
export type {
  LlmContent,
  LlmPrompt,
  LlmRequest,
  LlmResult,
  LlmSchema,
  LlmTokenUsage,
  LlmTraceOptions,
  LlmUpstreamSnapshot,
} from "./types.js";

// Re-exported for tests; not part of the public callLlm contract.
export { extractStructuredOutput } from "./openaiResponse.js";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

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

  type RetryOutcome = "none" | "recovered" | "still_truncated" | "error";

  const run = async (agentSpan?: Sentry.Span) => {
    let attempts = 1;
    let initialTruncated = false;
    let retryOutcome: RetryOutcome = "none";

    let result = await executeOpenAiRequest(
      request.apiKey,
      initialBody,
      { ...baseMeta, attempt: 1 },
      request.trace.enabled,
    );

    if (result.response.ok && isMaxTokensTruncation(result.payload)) {
      initialTruncated = true;
      attempts = 2;
      result = await executeOpenAiRequest(
        request.apiKey,
        { ...initialBody, max_output_tokens: request.retryMaxOutputTokens },
        { ...baseMeta, attempt: 2 },
        request.trace.enabled,
      );

      if (!result.response.ok) {
        retryOutcome = "error";
      } else if (isMaxTokensTruncation(result.payload)) {
        retryOutcome = "still_truncated";
      } else {
        retryOutcome = "recovered";
      }
    }

    if (agentSpan) {
      agentSpan.setAttribute("gen_ai.retry.attempts", attempts);
      agentSpan.setAttribute("gen_ai.retry.outcome", retryOutcome);
      agentSpan.setAttribute("gen_ai.truncation.detected", initialTruncated);
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
        (agentSpan) => run(agentSpan),
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
