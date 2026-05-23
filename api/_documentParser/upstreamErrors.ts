import type { CvParserErrorCode } from "./errors.js";

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

export function normalizeUpstreamErrorCode(
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

export { extractOpenAiErrorRecord };
