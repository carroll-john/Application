export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_INLINE_TEXT_CHARS = 60_000;

const SUPPORTED_MIME_TYPES = new Set([
  "application/msword",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);
const SUPPORTED_FILE_PATTERN = /\.(doc|docx|pdf|txt)$/i;

export interface ParsedUploadFile {
  arrayBuffer: () => Promise<ArrayBuffer>;
  name: string;
  size: number;
  type: string;
}

export function toParsedUploadFile(value: FormDataEntryValue | null): ParsedUploadFile | null {
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

export function isSupportedFile(file: ParsedUploadFile) {
  return SUPPORTED_MIME_TYPES.has(file.type) || SUPPORTED_FILE_PATTERN.test(file.name);
}

export function inferMimeType(file: ParsedUploadFile) {
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

export function isFileBufferConsistentWithMimeType(
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

export function decodeTextFile(buffer: ArrayBuffer) {
  const decoded = new TextDecoder().decode(buffer).replace(/\0/g, "").trim();

  if (!decoded) {
    return "";
  }

  if (decoded.length <= MAX_INLINE_TEXT_CHARS) {
    return decoded;
  }

  return decoded.slice(0, MAX_INLINE_TEXT_CHARS);
}
