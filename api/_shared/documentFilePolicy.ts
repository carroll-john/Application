export const DOCUMENT_PARSER_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const DOCUMENT_PARSER_MAX_INLINE_TEXT_CHARS = 60_000;

export const DOCUMENT_PARSER_SUPPORTED_MIME_TYPES = [
  "application/msword",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
] as const;

export const DOCUMENT_PARSER_SUPPORTED_FILE_PATTERN = /\.(doc|docx|pdf|txt)$/i;
