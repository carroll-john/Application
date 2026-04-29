import * as Sentry from "@sentry/node";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase.types";
import { callLlm, type LlmContent } from "./_ai/callLlm";
import { cvEmploymentPromptV1 } from "./_ai/prompts/cvEmployment.v1";
import { cvEmploymentSchemaV1 } from "./_ai/schemas/cvEmployment.v1";

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
const SENTRY_FLUSH_TIMEOUT_MS = 1_500;
const SENTRY_DSN =
  process.env.SENTRY_DSN?.trim() || process.env.VITE_SENTRY_DSN?.trim() || "";
const SENTRY_ENVIRONMENT =
  process.env.SENTRY_ENVIRONMENT?.trim() ||
  process.env.VITE_SENTRY_ENVIRONMENT?.trim() ||
  process.env.VERCEL_ENV?.trim() ||
  process.env.NODE_ENV ||
  "development";
const SHOULD_FILTER_SMOKE_EVENTS =
  SENTRY_ENVIRONMENT.toLowerCase() !== "development";
const SENTRY_RELEASE =
  process.env.SENTRY_RELEASE?.trim() || process.env.VERCEL_GIT_COMMIT_SHA?.trim();
const SENTRY_ENABLED_VALUE =
  process.env.SENTRY_ENABLED?.trim() ?? process.env.VITE_SENTRY_ENABLED?.trim();
const SENTRY_AGENT_NAME =
  process.env.SENTRY_AGENT_NAME?.trim() || "cv-parser-employment-agent";
const SENTRY_AI_RECORD_INPUTS =
  process.env.SENTRY_AI_RECORD_INPUTS?.trim().toLowerCase() === "true";
const SENTRY_AI_RECORD_OUTPUTS =
  process.env.SENTRY_AI_RECORD_OUTPUTS?.trim().toLowerCase() === "true";
const SENTRY_TRACES_SAMPLE_RATE = parseSampleRate(
  process.env.SENTRY_TRACES_SAMPLE_RATE?.trim() ||
    process.env.VITE_SENTRY_TRACES_SAMPLE_RATE?.trim(),
  0.1,
);
const IS_API_SENTRY_ENABLED =
  Boolean(SENTRY_DSN) &&
  (!SENTRY_ENABLED_VALUE || SENTRY_ENABLED_VALUE.toLowerCase() === "true");
const IS_API_SENTRY_TRACING_ENABLED =
  IS_API_SENTRY_ENABLED && SENTRY_TRACES_SAMPLE_RATE > 0;
const SENTRY_SMOKE_MARKERS = [
  "sentry smoke test",
  "codex sentry smoke",
  "codex-ingest-check-final",
  "dev_sentry_smoke",
  "/dev/sentry-smoke",
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json",
    },
    status,
  });
}

type CvParserErrorCode =
  | "CV_PARSER_METHOD_NOT_ALLOWED"
  | "CV_PARSER_NOT_CONFIGURED"
  | "CV_PARSER_UNAUTHORIZED"
  | "CV_PARSER_RATE_LIMITED"
  | "CV_PARSER_FILE_REQUIRED"
  | "CV_PARSER_FILE_UNSUPPORTED"
  | "CV_PARSER_FILE_TOO_LARGE"
  | "CV_PARSER_TEXT_FILE_EMPTY"
  | "CV_PARSER_UPSTREAM_FAILED"
  | "CV_PARSER_UPSTREAM_RATE_LIMITED"
  | "CV_PARSER_UPSTREAM_TIMEOUT"
  | "CV_PARSER_UPSTREAM_UNAVAILABLE"
  | "CV_PARSER_RESPONSE_TRUNCATED"
  | "CV_PARSER_RESPONSE_INVALID"
  | "CV_PARSER_RESPONSE_UNREADABLE"
  | "CV_PARSER_UNEXPECTED_FAILURE"
  | "CV_PARSER_UNSUPPORTED_REQUEST_SHAPE";

const CV_PARSER_ERROR_DEFINITIONS: Record<
  CvParserErrorCode,
  { message: string; status: number }
> = {
  CV_PARSER_METHOD_NOT_ALLOWED: {
    message: "Method not allowed.",
    status: 405,
  },
  CV_PARSER_NOT_CONFIGURED: {
    message: "AI CV parsing is not configured on this deployment.",
    status: 503,
  },
  CV_PARSER_UNAUTHORIZED: {
    message: "Sign in before parsing a CV.",
    status: 401,
  },
  CV_PARSER_RATE_LIMITED: {
    message: "You've parsed too many CVs in a short window. Please wait a moment.",
    status: 429,
  },
  CV_PARSER_FILE_REQUIRED: {
    message: "Attach a CV file before parsing.",
    status: 400,
  },
  CV_PARSER_FILE_UNSUPPORTED: {
    message: "Use a PDF, DOC, DOCX, or TXT file for CV parsing.",
    status: 400,
  },
  CV_PARSER_FILE_TOO_LARGE: {
    message: "Choose a file smaller than 5 MB.",
    status: 400,
  },
  CV_PARSER_TEXT_FILE_EMPTY: {
    message: "This text file appears to be empty. Upload a CV with content.",
    status: 400,
  },
  CV_PARSER_UPSTREAM_FAILED: {
    message: "We couldn't parse this CV right now. Please try again.",
    status: 502,
  },
  CV_PARSER_UPSTREAM_RATE_LIMITED: {
    message: "The parser is busy right now. Please try again shortly.",
    status: 502,
  },
  CV_PARSER_UPSTREAM_TIMEOUT: {
    message: "The parser took too long to respond. Please try again.",
    status: 502,
  },
  CV_PARSER_UPSTREAM_UNAVAILABLE: {
    message: "The parser is temporarily unavailable. Please try again shortly.",
    status: 502,
  },
  CV_PARSER_RESPONSE_TRUNCATED: {
    message:
      "The parser response was cut off for this CV. Please try again or upload a shorter file.",
    status: 502,
  },
  CV_PARSER_RESPONSE_INVALID: {
    message: "The parser did not return employment data in the expected format.",
    status: 502,
  },
  CV_PARSER_RESPONSE_UNREADABLE: {
    message: "The parser returned an unreadable response.",
    status: 502,
  },
  CV_PARSER_UNEXPECTED_FAILURE: {
    message: "Unexpected parser failure.",
    status: 500,
  },
  CV_PARSER_UNSUPPORTED_REQUEST_SHAPE: {
    message: "Unsupported request shape.",
    status: 500,
  },
};

function errorResponse(code: CvParserErrorCode) {
  const definition = CV_PARSER_ERROR_DEFINITIONS[code];

  return jsonResponse(
    {
      code,
      error: definition.message,
    },
    definition.status,
  );
}

function getBearerToken(headers: Headers) {
  const authorization = headers.get("authorization")?.trim() ?? "";

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = authorization.slice("bearer ".length).trim();
  return token || null;
}

function getSupabaseProjectConfig() {
  const url =
    process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim();
  const anonKey =
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    return null;
  }

  return { anonKey, url };
}

// Loud warning if a deploy has OPENAI configured but no Supabase auth
// settings: the route falls back to open mode in that state and would
// burn tokens for any anonymous caller. Local dev / regression hits
// the no-OPENAI path and stays silent.
if (process.env.OPENAI_API_KEY?.trim() && !getSupabaseProjectConfig()) {
  console.warn(
    "[parse-cv] OPENAI_API_KEY is set but SUPABASE_URL/SUPABASE_ANON_KEY are missing — auth gating is disabled and the route accepts unauthenticated requests.",
  );
}

const PARSE_CV_RATE_LIMIT_MAX = 10;
const PARSE_CV_RATE_LIMIT_WINDOW_MS = 60_000;
const parseCvRecentRequests = new Map<string, number[]>();

function isRateLimited(key: string) {
  const now = Date.now();
  const windowStart = now - PARSE_CV_RATE_LIMIT_WINDOW_MS;
  const previous = parseCvRecentRequests.get(key) ?? [];
  const recent = previous.filter((timestamp) => timestamp > windowStart);

  if (recent.length >= PARSE_CV_RATE_LIMIT_MAX) {
    parseCvRecentRequests.set(key, recent);
    return true;
  }

  recent.push(now);
  parseCvRecentRequests.set(key, recent);
  return false;
}

async function authenticateRequest(request: Request): Promise<
  | { kind: "unauthenticated" }
  | { kind: "open" }
  | { kind: "authenticated"; userId: string }
> {
  const supabaseConfig = getSupabaseProjectConfig();

  if (!supabaseConfig) {
    return { kind: "open" };
  }

  const accessToken = getBearerToken(request.headers);

  if (!accessToken) {
    return { kind: "unauthenticated" };
  }

  const supabase = createClient<Database>(
    supabaseConfig.url,
    supabaseConfig.anonKey,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
      global: {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    },
  );

  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data.user) {
    return { kind: "unauthenticated" };
  }

  return { kind: "authenticated", userId: data.user.id };
}

function extractOpenAiErrorRecord(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return {
      code: null,
      message: null,
      type: null,
    };
  }

  const record = payload as Record<string, unknown>;

  if (!record.error || typeof record.error !== "object") {
    return {
      code: null,
      message: null,
      type: null,
    };
  }

  const errorRecord = record.error as Record<string, unknown>;
  const code =
    typeof errorRecord.code === "string" || typeof errorRecord.code === "number"
      ? String(errorRecord.code)
      : null;
  const message =
    typeof errorRecord.message === "string" && errorRecord.message.trim()
      ? errorRecord.message
      : null;
  const type =
    typeof errorRecord.type === "string" && errorRecord.type.trim()
      ? errorRecord.type
      : null;

  return {
    code,
    message,
    type,
  };
}

function normalizeUpstreamErrorCode(
  upstreamStatus: number,
  payload: unknown,
): CvParserErrorCode {
  const upstreamError = extractOpenAiErrorRecord(payload);
  const normalizedType = upstreamError.type?.toLowerCase() ?? "";
  const normalizedCode = upstreamError.code?.toLowerCase() ?? "";

  if (
    upstreamStatus === 429 ||
    normalizedType.includes("rate_limit") ||
    normalizedCode.includes("rate_limit")
  ) {
    return "CV_PARSER_UPSTREAM_RATE_LIMITED";
  }

  if (
    upstreamStatus === 408 ||
    upstreamStatus === 504 ||
    normalizedType.includes("timeout") ||
    normalizedCode.includes("timeout")
  ) {
    return "CV_PARSER_UPSTREAM_TIMEOUT";
  }

  if (upstreamStatus >= 500) {
    return "CV_PARSER_UPSTREAM_UNAVAILABLE";
  }

  return "CV_PARSER_UPSTREAM_FAILED";
}

function buildSentryContext(
  request: Request,
  extras?: Record<string, unknown>,
  tags?: Record<string, string>,
) {
  return {
    extras: {
      request_method: request.method,
      ...extras,
    },
    tags: {
      api_route: "/api/parse-cv",
      ...tags,
    },
  };
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

type SentryEventContext = {
  extras?: Record<string, unknown>;
  tags?: Record<string, string>;
};

type SentryMessageContext = SentryEventContext & {
  level?: "debug" | "log" | "info" | "warning" | "error" | "fatal";
};

function parseSampleRate(value: string | undefined, fallback: number) {
  const parsed = Number.parseFloat(value ?? "");

  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.min(1, parsed));
}

function hasSmokeMarker(value: unknown): boolean {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return false;
  }

  const normalized = value.toLowerCase();
  return SENTRY_SMOKE_MARKERS.some((marker) => normalized.includes(marker));
}

function isSmokeSentryEvent(event: Sentry.Event) {
  if (hasSmokeMarker(event.message) || hasSmokeMarker(event.transaction)) {
    return true;
  }

  if (hasSmokeMarker(event.request?.url)) {
    return true;
  }

  if (
    event.tags?.flow === "dev_sentry_smoke" ||
    String(event.tags?.smoke_test ?? "").toLowerCase() === "true"
  ) {
    return true;
  }

  if (
    event.extra?.smokeTest === true ||
    String(event.extra?.smokeTest ?? "").toLowerCase() === "true"
  ) {
    return true;
  }

  if (
    event.exception?.values?.some(
      (value) => hasSmokeMarker(value.value) || hasSmokeMarker(value.type),
    )
  ) {
    return true;
  }

  return Object.values(event.tags ?? {}).some((value) =>
    hasSmokeMarker(String(value)),
  );
}

let apiSentryStarted = false;

function initApiSentry() {
  if (!IS_API_SENTRY_ENABLED || apiSentryStarted) {
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    release: SENTRY_RELEASE || undefined,
    tracesSampleRate: SENTRY_TRACES_SAMPLE_RATE,
    beforeSend(event) {
      return SHOULD_FILTER_SMOKE_EVENTS && isSmokeSentryEvent(event) ? null : event;
    },
    beforeSendTransaction(event) {
      return SHOULD_FILTER_SMOKE_EVENTS && isSmokeSentryEvent(event)
        ? null
        : event;
    },
  });

  apiSentryStarted = true;
}

initApiSentry();

async function flushSentry() {
  if (!IS_API_SENTRY_ENABLED) {
    return;
  }

  try {
    await Sentry.flush(SENTRY_FLUSH_TIMEOUT_MS);
  } catch {
    // Best effort capture only.
  }
}

function withSentryScope(context: SentryEventContext | undefined, callback: () => void) {
  Sentry.withScope((scope) => {
    scope.setTag("api_route", "/api/parse-cv");
    Object.entries(context?.tags ?? {}).forEach(([key, value]) => {
      scope.setTag(key, value);
    });
    Object.entries(context?.extras ?? {}).forEach(([key, value]) => {
      scope.setExtra(key, value);
    });
    callback();
  });
}

async function captureApiException(error: unknown, context?: SentryEventContext) {
  if (!IS_API_SENTRY_ENABLED) {
    return;
  }

  const errorObject =
    error instanceof Error ? error : new Error(typeof error === "string" ? error : "Unknown error");

  withSentryScope(context, () => {
    Sentry.captureException(errorObject);
  });
}

async function captureApiMessage(message: string, context?: SentryMessageContext) {
  if (!IS_API_SENTRY_ENABLED) {
    return;
  }

  withSentryScope(context, () => {
    Sentry.captureMessage(message, context?.level ?? "error");
  });
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

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04]; // DOCX is a ZIP container
const OLE2_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]; // legacy DOC

function startsWith(bytes: Uint8Array, signature: number[]) {
  if (bytes.length < signature.length) {
    return false;
  }

  for (let index = 0; index < signature.length; index += 1) {
    if (bytes[index] !== signature[index]) {
      return false;
    }
  }

  return true;
}

// Verify the file's first bytes match its claimed MIME type. Catches forged
// extensions (e.g. .exe renamed to .pdf) before we forward to OpenAI.
// Container signatures (ZIP, OLE2) are shared with sibling formats — this
// blocks obvious forgeries, not deep cross-format spoofing.
function isFileBufferConsistentWithMimeType(
  buffer: ArrayBuffer,
  mimeType: string,
) {
  const head = new Uint8Array(buffer.slice(0, 16));

  switch (mimeType) {
    case "application/pdf":
      return startsWith(head, PDF_SIGNATURE);
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return startsWith(head, ZIP_SIGNATURE);
    case "application/msword":
      return startsWith(head, OLE2_SIGNATURE);
    case "text/plain":
      return true;
    default:
      return false;
  }
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

async function handleWebRequest(request: Request) {
  try {
    if (request.method !== "POST") {
      return errorResponse("CV_PARSER_METHOD_NOT_ALLOWED");
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();

    if (!apiKey) {
      return errorResponse("CV_PARSER_NOT_CONFIGURED");
    }

    const authResult = await authenticateRequest(request);

    if (authResult.kind === "unauthenticated") {
      return errorResponse("CV_PARSER_UNAUTHORIZED");
    }

    if (authResult.kind === "authenticated") {
      if (isRateLimited(`user:${authResult.userId}`)) {
        return errorResponse("CV_PARSER_RATE_LIMITED");
      }
    }

    const formData = await request.formData();
    const file = toParsedUploadFile(formData.get("file"));

    if (!file) {
      return errorResponse("CV_PARSER_FILE_REQUIRED");
    }

    if (!isSupportedFile(file)) {
      return errorResponse("CV_PARSER_FILE_UNSUPPORTED");
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return errorResponse("CV_PARSER_FILE_TOO_LARGE");
    }

    const fileBuffer = await file.arrayBuffer();
    const mimeType = inferMimeType(file);
    const isPlainTextFile = mimeType === "text/plain";

    if (!isFileBufferConsistentWithMimeType(fileBuffer, mimeType)) {
      return errorResponse("CV_PARSER_FILE_UNSUPPORTED");
    }

    const model = process.env.OPENAI_CV_PARSER_MODEL?.trim() || DEFAULT_MODEL;

    const attachments: LlmContent[] = [];

    if (isPlainTextFile) {
      const cvText = decodeTextFile(fileBuffer);

      if (!cvText) {
        return errorResponse("CV_PARSER_TEXT_FILE_EMPTY");
      }

      attachments.push({ kind: "text", text: `CV text:\n${cvText}` });
    } else {
      attachments.push({
        kind: "file",
        filename: file.name,
        mimeType,
        data: fileBuffer,
      });
    }

    const llmResult = await callLlm({
      provider: "openai",
      apiKey,
      model,
      prompt: cvEmploymentPromptV1,
      schema: cvEmploymentSchemaV1,
      attachments,
      initialMaxOutputTokens: INITIAL_MAX_OUTPUT_TOKENS,
      retryMaxOutputTokens: RETRY_MAX_OUTPUT_TOKENS,
      enableCodeInterpreter: !isPlainTextFile,
      trace: {
        enabled: IS_API_SENTRY_TRACING_ENABLED,
        agentName: SENTRY_AGENT_NAME,
        recordInputs: SENTRY_AI_RECORD_INPUTS,
        recordOutputs: SENTRY_AI_RECORD_OUTPUTS,
        agentSpanAttributes: {
          "cv_parser.file_mime_type": mimeType,
          "cv_parser.file_size_bytes": file.size,
        },
      },
    });

    if (llmResult.status === "upstream_error") {
      const upstreamError = extractOpenAiErrorRecord(llmResult.upstream.payload);
      const normalizedErrorCode = normalizeUpstreamErrorCode(
        llmResult.upstream.status,
        llmResult.upstream.payload,
      );

      await captureApiMessage(
        "CV parser upstream request failed",
        buildSentryContext(
          request,
          {
            model,
            openai_error: upstreamError.message ?? "unknown",
            openai_error_code: upstreamError.code ?? "unknown",
            openai_error_type: upstreamError.type ?? "unknown",
            parser_error_code: normalizedErrorCode,
            openai_status: llmResult.upstream.status,
            openai_status_text: llmResult.upstream.statusText,
          },
          {
            failure_stage: "openai_request",
          },
        ),
      );

      return errorResponse(normalizedErrorCode);
    }

    if (llmResult.status === "truncated") {
      return errorResponse("CV_PARSER_RESPONSE_TRUNCATED");
    }

    if (llmResult.status === "invalid_response") {
      const payload = llmResult.upstream.payload as
        | Record<string, unknown>
        | null
        | undefined;

      await captureApiMessage(
        "CV parser response format invalid",
        buildSentryContext(
          request,
          {
            model,
            payload_status:
              typeof payload?.status === "string" ? payload.status : "unknown",
          },
          {
            failure_stage: "response_shape",
          },
        ),
      );

      return errorResponse("CV_PARSER_RESPONSE_INVALID");
    }

    try {
      const extractedExperiences = findExperienceArray(llmResult.parsed);

      if (!extractedExperiences) {
        const payload = llmResult.upstream.payload as
          | Record<string, unknown>
          | null
          | undefined;

        await captureApiMessage(
          "CV parser response format invalid",
          buildSentryContext(
            request,
            {
              model,
              payload_status:
                typeof payload?.status === "string" ? payload.status : "unknown",
            },
            {
              failure_stage: "response_shape",
            },
          ),
        );

        return errorResponse("CV_PARSER_RESPONSE_INVALID");
      }

      const normalizedExperiences = extractedExperiences.map((item) =>
        normalizeExperienceEntry(item),
      );
      const experiences = expandCollapsedRoles(normalizedExperiences);

      return jsonResponse({ experiences, model });
    } catch (error) {
      const payload = llmResult.upstream.payload as
        | Record<string, unknown>
        | null
        | undefined;

      await captureApiException(
        error,
        buildSentryContext(
          request,
          {
            model,
            payload_status:
              typeof payload?.status === "string" ? payload.status : "unknown",
          },
          {
            failure_stage: "response_parse",
          },
        ),
      );

      return errorResponse("CV_PARSER_RESPONSE_UNREADABLE");
    }
  } catch (error) {
    await captureApiException(
      error,
      buildSentryContext(request, undefined, {
        failure_stage: "handler_unhandled",
      }),
    );

    return errorResponse("CV_PARSER_UNEXPECTED_FAILURE");
  } finally {
    if (IS_API_SENTRY_TRACING_ENABLED) {
      await flushSentry();
    }
  }
}

type NodeRequestHeaders = Record<string, string | string[] | undefined>;

type NodeRequestLike = AsyncIterable<unknown> & {
  headers: NodeRequestHeaders;
  method?: string;
  url?: string;
};

type NodeResponseLike = {
  end: (chunk?: Uint8Array | string) => void;
  setHeader: (name: string, value: string) => void;
  statusCode: number;
};

function isWebRequest(value: unknown): value is Request {
  return Boolean(
    value &&
      typeof value === "object" &&
      "method" in value &&
      "headers" in value &&
      typeof (value as Request).formData === "function",
  );
}

function toWebHeaders(nodeHeaders: NodeRequestHeaders) {
  const headers = new Headers();

  Object.entries(nodeHeaders).forEach(([key, value]) => {
    if (typeof value === "string") {
      headers.set(key, value);
      return;
    }

    if (Array.isArray(value)) {
      headers.set(key, value.join(", "));
    }
  });

  return headers;
}

function supportsRequestBody(method: string) {
  return !["GET", "HEAD"].includes(method.toUpperCase());
}

async function readNodeRequestBody(nodeRequest: NodeRequestLike) {
  const chunks: Uint8Array[] = [];

  for await (const chunk of nodeRequest) {
    if (chunk instanceof Uint8Array) {
      chunks.push(chunk);
      continue;
    }

    if (typeof chunk === "string") {
      chunks.push(new TextEncoder().encode(chunk));
      continue;
    }

    if (chunk instanceof ArrayBuffer) {
      chunks.push(new Uint8Array(chunk));
    }
  }

  if (chunks.length === 0) {
    return undefined;
  }

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;

  chunks.forEach((chunk) => {
    combined.set(chunk, offset);
    offset += chunk.length;
  });

  return combined;
}

async function handleNodeRequest(nodeRequest: NodeRequestLike, nodeResponse: NodeResponseLike) {
  const method = (nodeRequest.method || "GET").toUpperCase();
  const headers = toWebHeaders(nodeRequest.headers || {});
  const host = headers.get("x-forwarded-host") || headers.get("host") || "localhost";
  const protocol = headers.get("x-forwarded-proto") || "https";
  const pathname = nodeRequest.url || "/api/parse-cv";
  const body = supportsRequestBody(method) ? await readNodeRequestBody(nodeRequest) : undefined;

  const requestInit: RequestInit & { duplex?: "half" } = {
    body,
    headers,
    method,
  };

  if (supportsRequestBody(method)) {
    requestInit.duplex = "half";
  }

  const webRequest = new Request(
    new URL(pathname, `${protocol}://${host}`).toString(),
    requestInit,
  );
  const webResponse = await handleWebRequest(webRequest);

  nodeResponse.statusCode = webResponse.status;
  webResponse.headers.forEach((value, key) => {
    nodeResponse.setHeader(key, value);
  });

  const responseBody = new Uint8Array(await webResponse.arrayBuffer());
  nodeResponse.end(responseBody);
}

export default async function handler(
  request: Request | NodeRequestLike,
  response?: NodeResponseLike,
) {
  if (isWebRequest(request)) {
    return handleWebRequest(request);
  }

  if (response) {
    await handleNodeRequest(request as NodeRequestLike, response);
    return;
  }

  return errorResponse("CV_PARSER_UNSUPPORTED_REQUEST_SHAPE");
}
