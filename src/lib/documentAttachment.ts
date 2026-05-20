import {
  deleteStoredDocument,
  replaceStoredDocument,
  type DocumentKind,
  type UploadedDocument,
} from "./documentStorage";

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
