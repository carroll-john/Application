export const config = {
  runtime: "edge",
};

const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const DEFAULT_MODEL = "gpt-4.1";
const SUPPORTED_MIME_TYPES = new Set([
  "application/msword",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);
const SUPPORTED_FILE_PATTERN = /\.(doc|docx|pdf|txt)$/i;

const EMPLOYMENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["experiences"],
  properties: {
    experiences: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "company",
          "currentRole",
          "duties",
          "endMonth",
          "endYear",
          "position",
          "startMonth",
          "startYear",
          "type",
        ],
        properties: {
          company: { type: "string" },
          currentRole: { type: "boolean" },
          duties: { type: "string" },
          endMonth: { type: "string" },
          endYear: { type: "string" },
          position: { type: "string" },
          startMonth: { type: "string" },
          startYear: { type: "string" },
          type: { type: "string" },
        },
      },
    },
  },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json",
    },
    status,
  });
}

function isSupportedFile(file: File) {
  return SUPPORTED_MIME_TYPES.has(file.type) || SUPPORTED_FILE_PATTERN.test(file.name);
}

function inferMimeType(file: File) {
  if (file.type) {
    return file.type;
  }

  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".pdf")) {
    return "application/pdf";
  }

  if (lowerName.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }

  if (lowerName.endsWith(".doc")) {
    return "application/msword";
  }

  if (lowerName.endsWith(".txt")) {
    return "text/plain";
  }

  return "application/octet-stream";
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

function extractJsonOutput(payload: any) {
  if (payload?.output_parsed && typeof payload.output_parsed === "object") {
    return payload.output_parsed;
  }

  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return JSON.parse(payload.output_text);
  }

  if (Array.isArray(payload?.output)) {
    for (const item of payload.output) {
      if (item?.type !== "message" || !Array.isArray(item.content)) {
        continue;
      }

      for (const contentItem of item.content) {
        if (
          (contentItem?.type === "output_text" || contentItem?.type === "text") &&
          typeof contentItem.text === "string" &&
          contentItem.text.trim()
        ) {
          return JSON.parse(contentItem.text);
        }
      }
    }
  }

  return null;
}

export default async function handler(request: Request) {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    return jsonResponse(
      { error: "AI CV parsing is not configured on this deployment." },
      503,
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return jsonResponse({ error: "Attach a CV file before parsing." }, 400);
  }

  if (!isSupportedFile(file)) {
    return jsonResponse(
      { error: "Use a PDF, DOC, DOCX, or TXT file for CV parsing." },
      400,
    );
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return jsonResponse({ error: "Choose a file smaller than 5 MB." }, 400);
  }

  const encodedFile = arrayBufferToBase64(await file.arrayBuffer());
  const model = process.env.OPENAI_CV_PARSER_MODEL?.trim() || DEFAULT_MODEL;

  const openAiResponse = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      tool_choice: "required",
      tools: [
        {
          type: "code_interpreter",
          container: { type: "auto" },
        },
      ],
      instructions:
        "Extract structured employment history from the uploaded CV or resume. Use code interpreter to read the file when needed. Return only actual employment roles that are evidenced in the document. Use the exact employment type labels Full-time, Part-time, Contract, Casual, Internship, or an empty string when unclear. Use full month names and four-digit years where possible. If a role is current, set currentRole to true and leave endMonth and endYear empty. Summarize duties in plain sentences without bullet characters.",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Parse this CV and extract employment experience so the application form can be auto-filled. Return the most recent roles first.",
            },
            {
              type: "input_file",
              filename: file.name,
              file_data: `data:${inferMimeType(file)};base64,${encodedFile}`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "cv_employment_parse",
          strict: true,
          schema: EMPLOYMENT_SCHEMA,
        },
      },
    }),
  });

  let payload: any = null;

  try {
    payload = await openAiResponse.json();
  } catch {
    payload = null;
  }

  if (!openAiResponse.ok) {
    const upstreamMessage =
      payload?.error?.message && typeof payload.error.message === "string"
        ? payload.error.message
        : "The OpenAI request failed.";

    return jsonResponse({ error: upstreamMessage }, 502);
  }

  try {
    const parsed = extractJsonOutput(payload);

    if (!parsed || !Array.isArray(parsed.experiences)) {
      return jsonResponse(
        { error: "The parser did not return employment data in the expected format." },
        502,
      );
    }

    return jsonResponse({
      experiences: parsed.experiences,
      model,
    });
  } catch {
    return jsonResponse(
      { error: "The parser returned an unreadable response." },
      502,
    );
  }
}
