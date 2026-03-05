const BYTES_PER_MEGABYTE = 1024 * 1024;

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const normalizedValue = value?.trim() ?? "";

  if (!/^\d+$/.test(normalizedValue)) {
    return fallback;
  }

  const parsed = Number.parseInt(normalizedValue, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export const DOCUMENT_UPLOAD_MAX_FILE_BYTES = 5 * BYTES_PER_MEGABYTE;
export const REMOTE_UPLOAD_MAX_FILES_PER_APPLICATION = parsePositiveInteger(
  import.meta.env.VITE_REMOTE_UPLOAD_MAX_FILES_PER_APPLICATION,
  30,
);
export const REMOTE_UPLOAD_MAX_TOTAL_BYTES_PER_APPLICATION = parsePositiveInteger(
  import.meta.env.VITE_REMOTE_UPLOAD_MAX_TOTAL_BYTES_PER_APPLICATION,
  100 * BYTES_PER_MEGABYTE,
);
export const REMOTE_UPLOAD_RATE_LIMIT_WINDOW_MINUTES = parsePositiveInteger(
  import.meta.env.VITE_REMOTE_UPLOAD_RATE_LIMIT_WINDOW_MINUTES,
  10,
);
export const REMOTE_UPLOAD_RATE_LIMIT_MAX_UPLOADS = parsePositiveInteger(
  import.meta.env.VITE_REMOTE_UPLOAD_RATE_LIMIT_MAX_UPLOADS,
  20,
);

export type DocumentUploadLimitErrorCode =
  | "UPLOAD_FILE_TOO_LARGE"
  | "UPLOAD_APP_FILE_COUNT_LIMIT"
  | "UPLOAD_APP_TOTAL_BYTES_LIMIT"
  | "UPLOAD_RATE_LIMIT";

interface DocumentUploadLimitErrorOptions {
  limit?: number;
  windowMinutes?: number;
}

export class DocumentUploadLimitError extends Error {
  readonly code: DocumentUploadLimitErrorCode;
  readonly limit?: number;
  readonly windowMinutes?: number;

  constructor(
    code: DocumentUploadLimitErrorCode,
    options: DocumentUploadLimitErrorOptions = {},
  ) {
    super(code);
    this.name = "DocumentUploadLimitError";
    this.code = code;
    this.limit = options.limit;
    this.windowMinutes = options.windowMinutes;
  }
}

function parseDetailValue(details: string | null, key: string): number | undefined {
  if (!details) {
    return undefined;
  }

  const match = details.match(new RegExp(`${key}=([0-9]+)`));

  if (!match?.[1]) {
    return undefined;
  }

  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function asErrorRecord(error: unknown): Record<string, unknown> | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  return error as Record<string, unknown>;
}

function formatLimitInMegabytes(limitBytes: number): string {
  if (limitBytes < BYTES_PER_MEGABYTE) {
    const kb = Math.max(1, Math.round(limitBytes / 1024));
    return `${kb} KB`;
  }

  const mb = limitBytes / BYTES_PER_MEGABYTE;
  const precision = Number.isInteger(mb) ? 0 : 1;
  return `${mb.toFixed(precision)} MB`;
}

export function assertDocumentUploadFileSize(fileSizeBytes: number): void {
  if (fileSizeBytes <= DOCUMENT_UPLOAD_MAX_FILE_BYTES) {
    return;
  }

  throw new DocumentUploadLimitError("UPLOAD_FILE_TOO_LARGE", {
    limit: DOCUMENT_UPLOAD_MAX_FILE_BYTES,
  });
}

export function toDocumentUploadLimitError(
  error: unknown,
): DocumentUploadLimitError | null {
  if (error instanceof DocumentUploadLimitError) {
    return error;
  }

  const record = asErrorRecord(error);

  if (!record) {
    return null;
  }

  const message = typeof record.message === "string" ? record.message : null;
  const details = typeof record.details === "string" ? record.details : null;
  const code =
    typeof record.code === "string" || typeof record.code === "number"
      ? String(record.code)
      : null;
  const normalizedMessage = message?.toLowerCase() ?? "";

  if (
    code === "413" ||
    normalizedMessage.includes("too large") ||
    normalizedMessage.includes("file size")
  ) {
    return new DocumentUploadLimitError("UPLOAD_FILE_TOO_LARGE", {
      limit: DOCUMENT_UPLOAD_MAX_FILE_BYTES,
    });
  }

  if (message === "UPLOAD_APP_FILE_COUNT_LIMIT") {
    return new DocumentUploadLimitError("UPLOAD_APP_FILE_COUNT_LIMIT", {
      limit:
        parseDetailValue(details, "max_files") ??
        REMOTE_UPLOAD_MAX_FILES_PER_APPLICATION,
    });
  }

  if (message === "UPLOAD_APP_TOTAL_BYTES_LIMIT") {
    return new DocumentUploadLimitError("UPLOAD_APP_TOTAL_BYTES_LIMIT", {
      limit:
        parseDetailValue(details, "max_bytes") ??
        REMOTE_UPLOAD_MAX_TOTAL_BYTES_PER_APPLICATION,
    });
  }

  if (message === "UPLOAD_RATE_LIMIT") {
    return new DocumentUploadLimitError("UPLOAD_RATE_LIMIT", {
      limit:
        parseDetailValue(details, "max_uploads") ??
        REMOTE_UPLOAD_RATE_LIMIT_MAX_UPLOADS,
      windowMinutes:
        parseDetailValue(details, "window_minutes") ??
        REMOTE_UPLOAD_RATE_LIMIT_WINDOW_MINUTES,
    });
  }

  return null;
}

export function getDocumentUploadErrorMessage(error: unknown): string | null {
  const limitError = toDocumentUploadLimitError(error);

  if (!limitError) {
    return null;
  }

  if (limitError.code === "UPLOAD_FILE_TOO_LARGE") {
    const label = formatLimitInMegabytes(
      limitError.limit ?? DOCUMENT_UPLOAD_MAX_FILE_BYTES,
    );
    return `Choose a file smaller than ${label}.`;
  }

  if (limitError.code === "UPLOAD_APP_FILE_COUNT_LIMIT") {
    const limit = limitError.limit ?? REMOTE_UPLOAD_MAX_FILES_PER_APPLICATION;
    return `You've reached this application's upload quota (${limit} files). Remove one before uploading another.`;
  }

  if (limitError.code === "UPLOAD_APP_TOTAL_BYTES_LIMIT") {
    const label = formatLimitInMegabytes(
      limitError.limit ?? REMOTE_UPLOAD_MAX_TOTAL_BYTES_PER_APPLICATION,
    );
    return `This upload would exceed this application's document quota (${label} total). Remove a file or upload a smaller one.`;
  }

  const limit = limitError.limit ?? REMOTE_UPLOAD_RATE_LIMIT_MAX_UPLOADS;
  const windowMinutes =
    limitError.windowMinutes ?? REMOTE_UPLOAD_RATE_LIMIT_WINDOW_MINUTES;
  return `You've reached the upload rate limit (${limit} uploads per ${windowMinutes} minutes). Please wait, then try again.`;
}
