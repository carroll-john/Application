import type { DocumentKind } from "./documentStorage";

export interface ApplicationDocumentStoragePathInput {
  userId: string;
  applicationId: string;
  kind: DocumentKind;
  documentId: string;
  fileName: string;
}

export interface ParsedApplicationDocumentStoragePath {
  ownerUserId: string;
  applicationId: string;
  kind: DocumentKind;
  documentId: string;
  fileName: string;
}

export function sanitizeDocumentFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export function buildApplicationDocumentStoragePath(
  input: ApplicationDocumentStoragePathInput,
): string {
  const safeName = sanitizeDocumentFileName(input.fileName);
  return `${input.userId}/${input.applicationId}/${input.kind}/${input.documentId}-${safeName}`;
}

export function getApplicationDocumentObjectPrefix(input: {
  userId: string;
  applicationId: string;
}): string {
  return `${input.userId}/${input.applicationId}/`;
}

export function parseApplicationDocumentStoragePath(
  objectName: string,
): ParsedApplicationDocumentStoragePath {
  const pathParts = objectName.split("/");

  if (pathParts.length < 4) {
    throw new Error("UPLOAD_INVALID_STORAGE_PATH");
  }

  const ownerUserId = pathParts[0];
  const applicationId = pathParts[1];
  const kind = pathParts[2] as DocumentKind;
  const fileSegment = pathParts[3];
  const fileMatch = fileSegment.match(
    /^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})-(.+)$/i,
  );

  if (!ownerUserId || !applicationId || !kind || !fileMatch) {
    throw new Error("UPLOAD_INVALID_STORAGE_PATH");
  }

  const [, documentId, fileName] = fileMatch;

  if (!documentId || !fileName) {
    throw new Error("UPLOAD_INVALID_STORAGE_PATH");
  }

  return {
    ownerUserId,
    applicationId,
    kind,
    documentId,
    fileName,
  };
}

export function resolveStorageUploadOwnerUserId(
  parsedOwnerUserId: string,
  authUserId: string | null | undefined,
): string {
  if (authUserId && parsedOwnerUserId !== authUserId) {
    throw new Error("UPLOAD_STORAGE_OWNER_MISMATCH");
  }

  return parsedOwnerUserId;
}
