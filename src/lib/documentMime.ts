const SUPPORTED_DOCUMENT_MIME_TYPES = new Set([
  "application/msword",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

const GENERIC_MIME_TYPES = new Set([
  "",
  "application/octet-stream",
  "binary/octet-stream",
]);

const SUPPORTED_FILE_PATTERN = /\.(doc|docx|pdf|txt)$/i;

function inferMimeTypeFromFileName(fileName: string): string | null {
  const lowerName = fileName.toLowerCase();

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

  return null;
}

export function isSupportedDocumentFileName(fileName: string) {
  return SUPPORTED_FILE_PATTERN.test(fileName);
}

export function inferDocumentMimeType(file: Pick<File, "name" | "type">): string {
  const normalizedType = file.type.trim().toLowerCase();

  if (
    normalizedType &&
    !GENERIC_MIME_TYPES.has(normalizedType) &&
    SUPPORTED_DOCUMENT_MIME_TYPES.has(normalizedType)
  ) {
    return normalizedType;
  }

  const inferredFromName = inferMimeTypeFromFileName(file.name);

  if (inferredFromName) {
    return inferredFromName;
  }

  if (
    normalizedType &&
    !GENERIC_MIME_TYPES.has(normalizedType) &&
    SUPPORTED_DOCUMENT_MIME_TYPES.has(normalizedType)
  ) {
    return normalizedType;
  }

  return "application/octet-stream";
}
