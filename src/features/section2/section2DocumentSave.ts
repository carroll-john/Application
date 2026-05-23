import { saveDocumentAttachment } from "../../lib/documentAttachment";
import type { DocumentKind, UploadedDocument } from "../../lib/documentStorage";

export interface SaveSection2DocumentRecordOptions {
  applicationId?: string;
  currentDocument?: UploadedDocument;
  ensureApplicationRow: () => Promise<string>;
  kind: DocumentKind;
  originalDocument?: UploadedDocument;
  selectedFile: File | null;
}

export async function saveSection2DocumentRecord({
  applicationId: providedApplicationId,
  currentDocument,
  ensureApplicationRow,
  kind,
  originalDocument,
  selectedFile,
}: SaveSection2DocumentRecordOptions) {
  const applicationId =
    providedApplicationId ?? (await ensureApplicationRow());
  const document = await saveDocumentAttachment({
    applicationId,
    currentDocument,
    kind,
    originalDocument,
    selectedFile,
  });

  return {
    document,
    documentName: document?.name,
  };
}
