const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const DEFAULT_MODEL = "gpt-4.1-mini";
const MAX_INLINE_TEXT_CHARS = 60_000;
const INITIAL_MAX_OUTPUT_TOKENS = 700;
const RETRY_MAX_OUTPUT_TOKENS = 3_000;
const LIST_DELIMITER_PATTERN = /\r?\n+|;|\||•|\u2022|\s\/\s/g;
const LIST_WITH_COMMA_DELIMITER_PATTERN =
  /\r?\n+|;|\||•|\u2022|\s\/\s|,\s+(?=(?:[A-Za-z]{3,}|(?:19|20)\d{2}|Present|Current|Now))/g;
const CURRENT_ROLE_PATTERN = /\b(present|current|now)\b/i;
const POSITION_SEGMENT_WITH_DATES_PATTERN =
  /([^;\n|]+?)\s*\(([^()]*?(?:19|20)\d{2}[^()]*)\)/g;
const DATE_RANGE_DELIMITER_PATTERN = /\s+(?:-|–|—|to|->|→)\s+/i;
const MONTH_TOKEN_PATTERN =
  /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|0?[1-9]|1[0-2])\b/i;
const YEAR_TOKEN_PATTERN = /\b(19|20)\d{2}\b/;
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

interface ParsedUploadFile {
  arrayBuffer: () => Promise<ArrayBuffer>;
  name: string;
  size: number;
  type: string;
}

interface NormalizedExperienceEntry {
  company: string;
  currentRole: boolean;
  duties: string;
  endMonth: string;
  endYear: string;
  position: string;
  startMonth: string;
  startYear: string;
  type: string;
}

function toParsedUploadFile(value: FormDataEntryValue | null): ParsedUploadFile | null {
  if (!value || typeof value === "string") {
    return null;
  }

  if (typeof (value as Blob).arrayBuffer !== "function") {
    return null;
  }

  const name =
    "name" in value && typeof value.name === "string" && value.name.trim()
      ? value.name
      : "uploaded-file";
  const type =
    "type" in value && typeof value.type === "string" ? value.type : "";
  const size =
    "size" in value && typeof value.size === "number" ? value.size : 0;

  return {
    arrayBuffer: () => value.arrayBuffer(),
    name,
    size,
    type,
  };
}

function isSupportedFile(file: ParsedUploadFile) {
  return SUPPORTED_MIME_TYPES.has(file.type) || SUPPORTED_FILE_PATTERN.test(file.name);
}

function inferMimeType(file: ParsedUploadFile) {
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

function decodeTextFile(buffer: ArrayBuffer) {
  const decoded = new TextDecoder().decode(buffer).replace(/\0/g, "").trim();

  if (!decoded) {
    return "";
  }

  if (decoded.length <= MAX_INLINE_TEXT_CHARS) {
    return decoded;
  }

  return decoded.slice(0, MAX_INLINE_TEXT_CHARS);
}

function tryParseJsonText(candidate: string) {
  const trimmed = candidate.trim();

  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    // keep trying additional shapes below
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);

  if (fencedMatch?.[1]) {
    try {
      return JSON.parse(fencedMatch[1].trim());
    } catch {
      // continue to next strategy
    }
  }

  const firstObjectStart = trimmed.indexOf("{");
  const lastObjectEnd = trimmed.lastIndexOf("}");

  if (firstObjectStart >= 0 && lastObjectEnd > firstObjectStart) {
    try {
      return JSON.parse(trimmed.slice(firstObjectStart, lastObjectEnd + 1));
    } catch {
      // continue to next strategy
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

function extractJsonOutput(payload: any) {
  if (payload?.output_parsed && typeof payload.output_parsed === "object") {
    return payload.output_parsed;
  }

  const textCandidates: string[] = [];

  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    textCandidates.push(payload.output_text);
  }

  if (
    typeof payload?.response?.output_text === "string" &&
    payload.response.output_text.trim()
  ) {
    textCandidates.push(payload.response.output_text);
  }

  if (Array.isArray(payload?.output)) {
    for (const item of payload.output) {
      if (item?.type !== "message" || !Array.isArray(item.content)) {
        continue;
      }

      for (const contentItem of item.content) {
        if (contentItem?.parsed && typeof contentItem.parsed === "object") {
          return contentItem.parsed;
        }

        if (contentItem?.json && typeof contentItem.json === "object") {
          return contentItem.json;
        }

        if (
          (contentItem?.type === "output_text" || contentItem?.type === "text") &&
          typeof contentItem.text === "string" &&
          contentItem.text.trim()
        ) {
          textCandidates.push(contentItem.text);
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

function toStringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toBooleanValue(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

function normalizeExperienceEntry(entry: unknown): NormalizedExperienceEntry {
  const source = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};

  return {
    company: toStringValue(source.company ?? source.employer ?? source.organization),
    currentRole: toBooleanValue(
      source.currentRole ?? source.current_role ?? source.isCurrent ?? source.is_current,
    ),
    duties: toStringValue(
      source.duties ?? source.responsibilities ?? source.summary ?? source.description,
    ),
    endMonth: toStringValue(source.endMonth ?? source.end_month ?? source.toMonth),
    endYear: toStringValue(source.endYear ?? source.end_year ?? source.toYear),
    position: toStringValue(source.position ?? source.title ?? source.role),
    startMonth: toStringValue(
      source.startMonth ?? source.start_month ?? source.fromMonth,
    ),
    startYear: toStringValue(source.startYear ?? source.start_year ?? source.fromYear),
    type: toStringValue(source.type ?? source.employmentType ?? source.employment_type),
  };
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function splitListSegments(value: string, allowComma = false) {
  const trimmed = value.trim();

  if (!trimmed) {
    return [] as string[];
  }

  const segments = trimmed
    .split(allowComma ? LIST_WITH_COMMA_DELIMITER_PATTERN : LIST_DELIMITER_PATTERN)
    .map((segment) => normalizeWhitespace(segment))
    .filter(Boolean);

  return segments.length > 0 ? segments : [trimmed];
}

function includesCurrentRoleMarker(value: string) {
  return CURRENT_ROLE_PATTERN.test(value);
}

function pickSegmentValue(segments: string[], index: number, fallback: string) {
  if (segments.length === 0) {
    return fallback;
  }

  if (segments.length === 1) {
    return segments[0];
  }

  if (index < segments.length) {
    return segments[index];
  }

  return segments[segments.length - 1];
}

function parseDatePart(value: string) {
  const normalized = normalizeWhitespace(value);
  const month = normalized.match(MONTH_TOKEN_PATTERN)?.[0] ?? "";
  const year = normalized.match(YEAR_TOKEN_PATTERN)?.[0] ?? "";

  return {
    currentRole: includesCurrentRoleMarker(normalized),
    month,
    year,
  };
}

function parseDateRange(value: string) {
  const normalized = normalizeWhitespace(value);
  const parts = normalized
    .split(DATE_RANGE_DELIMITER_PATTERN)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);

  if (parts.length < 2) {
    const parsed = parseDatePart(normalized);

    return {
      currentRole: parsed.currentRole,
      endMonth: "",
      endYear: "",
      startMonth: parsed.month,
      startYear: parsed.year,
    };
  }

  const start = parseDatePart(parts[0]);
  const end = parseDatePart(parts.slice(1).join(" "));
  const currentRole = end.currentRole || includesCurrentRoleMarker(parts.slice(1).join(" "));

  return {
    currentRole,
    endMonth: currentRole ? "" : end.month,
    endYear: currentRole ? "" : end.year,
    startMonth: start.month,
    startYear: start.year,
  };
}

function expandPositionDateSegments(entry: NormalizedExperienceEntry) {
  const segments: Array<{ dateRange: string; position: string }> = [];

  for (const match of entry.position.matchAll(POSITION_SEGMENT_WITH_DATES_PATTERN)) {
    const position = normalizeWhitespace(match[1] ?? "");
    const dateRange = normalizeWhitespace(match[2] ?? "");

    if (!position || !dateRange) {
      continue;
    }

    segments.push({ dateRange, position });
  }

  if (segments.length < 2) {
    return null;
  }

  return segments.map((segment, index) => {
    const parsedRange = parseDateRange(segment.dateRange);
    const currentRole = parsedRange.currentRole || (entry.currentRole && index === 0);
    const startMonth = parsedRange.startMonth || entry.startMonth;
    const startYear = parsedRange.startYear || entry.startYear;
    const endMonth = currentRole ? "" : parsedRange.endMonth || entry.endMonth;
    const endYear = currentRole ? "" : parsedRange.endYear || entry.endYear;

    return {
      ...entry,
      currentRole,
      endMonth,
      endYear,
      position: segment.position,
      startMonth,
      startYear,
    };
  });
}

function expandDelimitedRoleLists(entry: NormalizedExperienceEntry) {
  const positionSegments = splitListSegments(entry.position);

  if (positionSegments.length < 2) {
    return null;
  }

  const startMonthSegments = splitListSegments(entry.startMonth, true);
  const startYearSegments = splitListSegments(entry.startYear, true);
  const endMonthSegments = splitListSegments(entry.endMonth, true);
  const endYearSegments = splitListSegments(entry.endYear, true);
  const dutiesSegments = splitListSegments(entry.duties);

  const supportingLists = [
    startMonthSegments,
    startYearSegments,
    endMonthSegments,
    endYearSegments,
    dutiesSegments,
  ].filter((segments) => segments.length > 1);

  const hasAlignedSupport = supportingLists.some(
    (segments) => segments.length === positionSegments.length,
  );

  if (!hasAlignedSupport) {
    return null;
  }

  return positionSegments.map((position, index) => {
    const startMonth = pickSegmentValue(startMonthSegments, index, entry.startMonth);
    const startYear = pickSegmentValue(startYearSegments, index, entry.startYear);
    const endMonthCandidate = pickSegmentValue(endMonthSegments, index, entry.endMonth);
    const endYearCandidate = pickSegmentValue(endYearSegments, index, entry.endYear);
    const duties = pickSegmentValue(dutiesSegments, index, entry.duties);

    const inferredCurrentRole =
      includesCurrentRoleMarker(endMonthCandidate) ||
      includesCurrentRoleMarker(endYearCandidate);
    const currentRole = inferredCurrentRole || (entry.currentRole && index === 0);

    return {
      ...entry,
      currentRole,
      duties,
      endMonth: currentRole ? "" : endMonthCandidate,
      endYear: currentRole ? "" : endYearCandidate,
      position,
      startMonth,
      startYear,
    };
  });
}

function createExperienceSignature(entry: NormalizedExperienceEntry) {
  return [
    entry.company,
    entry.position,
    entry.type,
    entry.startMonth,
    entry.startYear,
    entry.endMonth,
    entry.endYear,
    entry.currentRole ? "current" : "ended",
    entry.duties,
  ]
    .map((value) => value.trim().toLowerCase())
    .join("|");
}

function expandCollapsedRoles(entries: NormalizedExperienceEntry[]) {
  const expanded = entries.flatMap((entry) => {
    const fromPositionDates = expandPositionDateSegments(entry);

    if (fromPositionDates) {
      return fromPositionDates;
    }

    const fromDelimitedLists = expandDelimitedRoleLists(entry);

    if (fromDelimitedLists) {
      return fromDelimitedLists;
    }

    return [entry];
  });

  const seen = new Set<string>();

  return expanded.filter((entry) => {
    const signature = createExperienceSignature(entry);

    if (seen.has(signature)) {
      return false;
    }

    seen.add(signature);
    return true;
  });
}

function isLikelyExperienceArray(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }

  return value.some((item) => {
    if (!item || typeof item !== "object") {
      return false;
    }

    const candidate = item as Record<string, unknown>;

    return Boolean(
      candidate.company ??
        candidate.employer ??
        candidate.organization ??
        candidate.position ??
        candidate.title ??
        candidate.role,
    );
  });
}

function findExperienceArray(source: unknown): unknown[] | null {
  if (isLikelyExperienceArray(source)) {
    return source as unknown[];
  }

  if (!source || typeof source !== "object") {
    return null;
  }

  const record = source as Record<string, unknown>;
  const preferredKeys = [
    "experiences",
    "employmentExperiences",
    "employment_experiences",
    "employmentHistory",
    "employment_history",
    "workExperience",
    "work_experience",
    "jobs",
    "roles",
  ];

  for (const key of preferredKeys) {
    if (isLikelyExperienceArray(record[key])) {
      return record[key] as unknown[];
    }
  }

  for (const value of Object.values(record)) {
    if (isLikelyExperienceArray(value)) {
      return value as unknown[];
    }
  }

  for (const value of Object.values(record)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = findExperienceArray(value);

      if (nested) {
        return nested;
      }
    }
  }

  return null;
}

async function requestOpenAi(
  apiKey: string,
  requestBody: Record<string, unknown>,
) {
  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  const payload = await response.json().catch(() => null);

  return {
    payload,
    response,
  };
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
  const file = toParsedUploadFile(formData.get("file"));

  if (!file) {
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

  const fileBuffer = await file.arrayBuffer();
  const mimeType = inferMimeType(file);
  const isPlainTextFile = mimeType === "text/plain";
  const model = process.env.OPENAI_CV_PARSER_MODEL?.trim() || DEFAULT_MODEL;

  const inputContent: Array<Record<string, string>> = [
    {
      type: "input_text",
      text: "Parse this CV and extract employment experience so the application form can be auto-filled. Return the most recent roles first.",
    },
  ];

  if (isPlainTextFile) {
    const cvText = decodeTextFile(fileBuffer);

    if (!cvText) {
      return jsonResponse(
        { error: "This text file appears to be empty. Upload a CV with content." },
        400,
      );
    }

    inputContent.push({
      type: "input_text",
      text: `CV text:\n${cvText}`,
    });
  } else {
    const encodedFile = arrayBufferToBase64(fileBuffer);
    inputContent.push({
      type: "input_file",
      filename: file.name,
      file_data: `data:${mimeType};base64,${encodedFile}`,
    });
  }

  const openAiRequestBody: Record<string, unknown> = {
    max_output_tokens: INITIAL_MAX_OUTPUT_TOKENS,
    model,
    instructions:
      "Extract structured employment history from the CV or resume content provided by the user. Return only actual employment roles that are evidenced in the document. Never merge multiple job titles into one row. If a person was promoted at the same company, output one experience item per distinct title with that title's own start and end dates, and repeat the company name for each role. Use the exact employment type labels Full-time, Part-time, Contract, Casual, Internship, or an empty string when unclear. Use full month names and four-digit years where possible. If a role is current, set currentRole to true and leave endMonth and endYear empty. Summarize duties in plain sentences without bullet characters. Before returning, verify each experience row has only one role title.",
    input: [
      {
        role: "user",
        content: inputContent,
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
  };

  if (!isPlainTextFile) {
    openAiRequestBody.tools = [
      {
        type: "code_interpreter",
        container: { type: "auto" },
      },
    ];
    openAiRequestBody.tool_choice = "auto";
  }

  let { payload, response: openAiResponse } = await requestOpenAi(
    apiKey,
    openAiRequestBody,
  );

  if (
    openAiResponse.ok &&
    payload?.status === "incomplete" &&
    payload?.incomplete_details?.reason === "max_output_tokens"
  ) {
    const retriedRequestBody = {
      ...openAiRequestBody,
      max_output_tokens: RETRY_MAX_OUTPUT_TOKENS,
    };

    const retriedResult = await requestOpenAi(apiKey, retriedRequestBody);
    payload = retriedResult.payload;
    openAiResponse = retriedResult.response;
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
    const extractedExperiences = findExperienceArray(parsed);

    if (!extractedExperiences) {
      if (
        payload?.status === "incomplete" &&
        payload?.incomplete_details?.reason === "max_output_tokens"
      ) {
        return jsonResponse(
          {
            error:
              "The parser response was cut off for this CV. Please try again or upload a shorter file.",
          },
          502,
        );
      }

      return jsonResponse(
        { error: "The parser did not return employment data in the expected format." },
        502,
      );
    }

    const normalizedExperiences = extractedExperiences.map((item) =>
      normalizeExperienceEntry(item),
    );
    const experiences = expandCollapsedRoles(normalizedExperiences);

    return jsonResponse({ experiences, model });
  } catch {
    return jsonResponse(
      { error: "The parser returned an unreadable response." },
      502,
    );
  }
}
