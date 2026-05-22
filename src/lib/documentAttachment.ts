import {
  deleteStoredDocument,
  replaceStoredDocument,
  type DocumentKind,
  type UploadedDocument,
} from "./documentStorage";

export function isSubmissionReadyDocument(document?: UploadedDocument) {
  if (!document?.id) {
    return false;
  }

  if (document.source === "remote") {
    return Boolean(document.storageBucket && document.storagePath);
  }

  return true;
}

export interface SaveDocumentAttachmentOptions {
  applicationId: string;
  currentDocument?: UploadedDocument;
  kind: DocumentKind;
  originalDocument?: UploadedDocument;
  selectedFile: File | null;
}

export async function saveDocumentAttachment({
  applicationId,
  currentDocument,
  kind,
  originalDocument,
  selectedFile,
}: SaveDocumentAttachmentOptions) {
  if (selectedFile) {
    return replaceStoredDocument(selectedFile, currentDocument ?? originalDocument, {
      applicationId,
      kind,
    });
  }

  if (!currentDocument && originalDocument) {
    await deleteStoredDocument(originalDocument);
    return undefined;
  }

  return currentDocument;
}
