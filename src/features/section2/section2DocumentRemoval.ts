import type { UploadedDocument } from "../../lib/documentStorage";

export function isSection2DocumentRemoved(options: {
  currentDocument?: UploadedDocument;
  originalDocument?: UploadedDocument;
  selectedFile: File | null;
}) {
  const hadStoredDocument = Boolean(options.originalDocument);
  const hasPendingDocument =
    Boolean(options.selectedFile) || Boolean(options.currentDocument);

  return hadStoredDocument && !hasPendingDocument;
}
