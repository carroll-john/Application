import type { LlmContent, LlmRequest, OpenAiContent } from "./types.js";

/** Builds the OpenAI Responses-API request body from an LlmRequest. */

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

export function toOpenAiContent(content: LlmContent): OpenAiContent {
  if (content.kind === "text") {
    return { type: "input_text", text: content.text };
  }

  return {
    type: "input_file",
    filename: content.filename,
    file_data: `data:${content.mimeType};base64,${arrayBufferToBase64(content.data)}`,
  };
}

export function buildOpenAiRequestBody(
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
