import { getDocumentUploadErrorMessage } from "../documentUploadLimits";

export type { DocumentKind, UploadedDocument } from "./documentTypes";

export { getDocumentUploadErrorMessage };

export { clearStoredDocuments } from "./localDocumentStore";
export {
  deleteStoredDocument,
  downloadStoredDocument,
  duplicateStoredDocument,
  loadStoredDocumentFile,
  replaceStoredDocument,
  saveDocumentFile,
  viewStoredDocument,
} from "./documentReplace";
export { formatFileSize, viewLocalDocument } from "./documentDelivery";
