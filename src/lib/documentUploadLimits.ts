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

function collectUploadErrorCandidates(error: unknown): unknown[] {
  const candidates: unknown[] = [error];
  const record = asErrorRecord(error);

  if (record?.error && typeof record.error === "object") {
    candidates.push(record.error);
  }

  if (error instanceof Error) {
    candidates.push({ message: error.message });
  }

  return candidates;
}

function getUploadErrorMessage(error: unknown): string | null {
  for (const candidate of collectUploadErrorCandidates(error)) {
    const record = asErrorRecord(candidate);

    if (!record) {
      continue;
    }

    const message = typeof record.message === "string" ? record.message : null;

    if (message) {
      return message;
    }
  }

  return null;
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

  for (const candidate of collectUploadErrorCandidates(error)) {
    const parsed = parseDocumentUploadLimitErrorRecord(candidate);

    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function parseDocumentUploadLimitErrorRecord(
  error: unknown,
): DocumentUploadLimitError | null {
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

function getKnownDocumentUploadErrorMessage(error: unknown): string | null {
  const message = getUploadErrorMessage(error);
  const normalizedMessage = message?.toLowerCase() ?? "";
  const record = asErrorRecord(error);
  const code =
    typeof record?.code === "string" || typeof record?.code === "number"
      ? String(record.code)
      : null;
  const rawStatusCode = record?.statusCode ?? record?.status;
  const statusCode =
    typeof rawStatusCode === "number"
      ? rawStatusCode
      : typeof rawStatusCode === "string" && /^\d+$/.test(rawStatusCode)
        ? Number.parseInt(rawStatusCode, 10)
        : null;

  if (message === "DOCUMENT_STORAGE_OBJECT_MISSING") {
    return "Upload didn't finish storing your file. Please try again.";
  }

  if (message === "UPLOAD_STORAGE_OWNER_MISMATCH") {
    return "Session mismatch — sign out and back in, then retry.";
  }

  if (message === "UPLOAD_APPLICATION_NOT_FOUND") {
    return "We couldn't find your application record. Refresh the page and try again.";
  }

  if (message === "UPLOAD_INVALID_STORAGE_PATH") {
    return "We couldn't save your CV because the upload path was invalid. Refresh the page and try again.";
  }

  if (
    normalizedMessage.includes("row-level security") ||
    normalizedMessage.includes("violates row-level security")
  ) {
    return "We couldn't save your CV because your session couldn't access this application. Sign out and back in, then try again.";
  }

  if (
    normalizedMessage.includes("invalid input syntax for type uuid") ||
    normalizedMessage.includes("invalid uuid")
  ) {
    return "We couldn't save your CV because this application draft is out of date. Refresh the page and try again.";
  }

  if (
    normalizedMessage.includes("mime") ||
    normalizedMessage.includes("content type") ||
    normalizedMessage.includes("invalid file type") ||
    (normalizedMessage.includes("not allowed") &&
      normalizedMessage.includes("type"))
  ) {
    return "This file type isn't supported. Use PDF, DOC, DOCX, or TXT.";
  }

  if (
    statusCode === 401 ||
    code === "401" ||
    normalizedMessage.includes("jwt") ||
    normalizedMessage.includes("not authenticated") ||
    normalizedMessage.includes("no authenticated session")
  ) {
    return "Sign in again before uploading.";
  }

  if (message === "Unable to create an application record.") {
    return "We couldn't create your application record. Refresh the page and try again.";
  }

  if (message === "Failed to save the application.") {
    return "We couldn't update your application after uploading. Refresh the page and try again.";
  }

  if (message === "Failed to store the uploaded document metadata.") {
    return "Upload didn't finish saving your file details. Please try again.";
  }

  if (message === "Supabase is not configured.") {
    return "Document storage isn't configured for this environment.";
  }

  if (
    normalizedMessage.includes("applications_cv_document_id_fkey") ||
    (normalizedMessage.includes("cv_document_id") &&
      normalizedMessage.includes("foreign key"))
  ) {
    return "We couldn't save your CV because the previous file reference is out of date. Refresh the page and try again.";
  }

  if (
    normalizedMessage.includes("foreign key constraint") ||
    code === "23503"
  ) {
    return "We couldn't link this upload to your application. Refresh the page and try again.";
  }

  return null;
}

export function getDocumentUploadErrorMessage(error: unknown): string | null {
  const knownMessage = getKnownDocumentUploadErrorMessage(error);

  if (knownMessage) {
    return knownMessage;
  }

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
