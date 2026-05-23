import { assertDocumentUploadFileSize } from "../documentUploadLimits";
import { supabase } from "../supabase";
import {
  deleteLocalDocument,
  loadLocalDocumentFile,
  saveLocalDocumentFile,
} from "./localDocumentStore";
import {
  downloadStoredRemoteDocument,
  loadRemoteDocumentFile,
  viewLocalDocument,
  viewStoredRemoteDocument,
} from "./documentDelivery";
import type { DocumentKind, UploadedDocument } from "./documentTypes";
import { saveRemoteDocumentFile } from "./remoteDocumentUpload";
import { getSupabaseSession } from "./documentDelivery";

export { formatFileSize, viewLocalDocument } from "./documentDelivery";

interface ReplaceStoredDocumentOptions {
  applicationId?: string;
  kind?: DocumentKind;
}

export function isRemoteDocument(document: UploadedDocument | undefined) {
  return Boolean(
    document?.source === "remote" &&
      document.storageBucket &&
      document.storagePath,
  );
}

export async function saveDocumentFile(file: File): Promise<UploadedDocument> {
  assertDocumentUploadFileSize(file.size);

  const document: UploadedDocument = {
    id: crypto.randomUUID(),
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: file.lastModified,
    uploadedAt: new Date().toISOString(),
    source: "local",
  };

  await saveLocalDocumentFile(file, document);
  return document;
}

export async function deleteStoredDocument(
  document: UploadedDocument | undefined,
): Promise<void> {
  if (!document?.id) {
    return;
  }

  if (isRemoteDocument(document) && supabase) {
    const bucket = document.storageBucket ?? "application-documents";
    const storagePath = document.storagePath;

    if (storagePath) {
      const { error: storageError } = await supabase.storage
        .from(bucket)
        .remove([storagePath]);

      if (storageError) {
        throw storageError;
      }
    }

    const { error: documentDeleteError } = await supabase
      .from("application_documents")
      .delete()
      .eq("id", document.id);

    if (documentDeleteError) {
      throw documentDeleteError;
    }

    return;
  }

  await deleteLocalDocument(document.id);
}

export async function replaceStoredDocument(
  nextFile: File | null,
  previousDocument?: UploadedDocument,
  options: ReplaceStoredDocumentOptions = {},
): Promise<UploadedDocument | undefined> {
  if (!nextFile) {
    return previousDocument;
  }

  const { applicationId, kind } = options;
  const session = supabase ? await getSupabaseSession() : null;
  const canUseRemote = Boolean(applicationId && kind && supabase && session);

  const savedDocument = canUseRemote
    ? await saveRemoteDocumentFile(nextFile, applicationId!, kind!)
    : await saveDocumentFile(nextFile);

  if (previousDocument?.id) {
    await deleteStoredDocument(previousDocument);
  }

  return savedDocument;
}

export async function duplicateStoredDocument(
  document: UploadedDocument | undefined,
  options: ReplaceStoredDocumentOptions = {},
): Promise<UploadedDocument | undefined> {
  if (!document?.id) {
    return undefined;
  }

  const sourceFile = isRemoteDocument(document)
    ? await loadRemoteDocumentFile(document)
    : await loadLocalDocumentFile(document.id);

  if (!sourceFile) {
    throw new Error(`Unable to duplicate document: ${document.name}`);
  }

  return replaceStoredDocument(sourceFile, undefined, options);
}

export async function downloadStoredDocument(
  document: UploadedDocument | undefined,
): Promise<boolean> {
  if (!document?.id) {
    return false;
  }

  if (isRemoteDocument(document)) {
    return downloadStoredRemoteDocument(document);
  }

  const file = await loadLocalDocumentFile(document.id);

  if (!file) {
    return false;
  }

  const url = URL.createObjectURL(file);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = document.name;
  link.rel = "noopener noreferrer";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  return true;
}

export async function viewStoredDocument(
  document: UploadedDocument | undefined,
): Promise<boolean> {
  if (!document?.id) {
    return false;
  }

  if (isRemoteDocument(document)) {
    return viewStoredRemoteDocument(document);
  }

  const file = await loadLocalDocumentFile(document.id);

  if (!file) {
    return false;
  }

  return viewLocalDocument(file);
}
