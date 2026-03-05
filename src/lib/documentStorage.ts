import { supabase } from "./supabase";

export type DocumentKind =
  | "cv"
  | "tertiary_transcript"
  | "tertiary_certificate"
  | "accreditation_document"
  | "language_test_document";

export interface UploadedDocument {
  id: string;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  uploadedAt: string;
  source?: "local" | "remote";
  storageBucket?: string;
  storagePath?: string;
}

interface StoredDocumentRecord extends UploadedDocument {
  blob: Blob;
}

interface RemoteDocumentRow {
  id: string;
  file_name: string;
  size_bytes: number;
  mime_type: string;
  created_at: string;
  storage_bucket: string;
  storage_path: string;
}

interface ReplaceStoredDocumentOptions {
  applicationId?: string;
  kind?: DocumentKind;
}

const DATABASE_NAME = "application-prototype-documents";
const STORE_NAME = "documents";
const DATABASE_VERSION = 1;
const STORAGE_BUCKET = "application-documents";
const REMOTE_DOCUMENT_PROXY_PATH = "/api/document-delivery";
const REMOTE_DOCUMENT_PROXY_IDENTIFIER_HEADER = "x-document-proxy";

type RemoteDocumentDisposition = "attachment" | "inline";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      reject(new Error("IndexedDB is not available in this environment."));
      return;
    }

    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = callback(store);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error);
  });
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function isRemoteDocument(document: UploadedDocument | undefined) {
  return Boolean(
    document?.source === "remote" &&
      document.storageBucket &&
      document.storagePath,
  );
}

async function getSupabaseSession() {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return data.session;
}

function isLocalhostRuntime() {
  if (typeof window === "undefined") {
    return false;
  }

  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

function triggerDocumentDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener noreferrer";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function buildProxyDocumentRequestUrl(
  documentId: string,
  disposition: RemoteDocumentDisposition,
) {
  const query = new URLSearchParams({
    disposition,
    documentId,
  });
  return `${REMOTE_DOCUMENT_PROXY_PATH}?${query.toString()}`;
}

async function requestRemoteDocumentProxy(
  document: UploadedDocument,
  disposition: RemoteDocumentDisposition,
) {
  const session = await getSupabaseSession();

  if (!session) {
    return null;
  }

  const response = await fetch(
    buildProxyDocumentRequestUrl(document.id, disposition),
    {
      cache: "no-store",
      headers: {
        authorization: `Bearer ${session.access_token}`,
      },
      method: "GET",
    },
  );

  if (
    response.headers.get(REMOTE_DOCUMENT_PROXY_IDENTIFIER_HEADER) !== "1" &&
    isLocalhostRuntime()
  ) {
    return null;
  }

  if (response.headers.get(REMOTE_DOCUMENT_PROXY_IDENTIFIER_HEADER) !== "1") {
    throw new Error("Unexpected remote document proxy response.");
  }

  return response;
}

async function createRemoteDocumentSignedUrl(
  document: UploadedDocument,
): Promise<string | null> {
  if (!document.storagePath || !supabase) {
    return null;
  }

  const { data, error } = await supabase.storage
    .from(document.storageBucket ?? STORAGE_BUCKET)
    .createSignedUrl(document.storagePath, 60);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

async function downloadRemoteDocumentViaSignedUrl(document: UploadedDocument) {
  const signedUrl = await createRemoteDocumentSignedUrl(document);

  if (!signedUrl) {
    return false;
  }

  const link = window.document.createElement("a");
  link.href = signedUrl;
  link.download = document.name;
  link.rel = "noopener noreferrer";
  link.click();
  return true;
}

async function viewRemoteDocumentViaSignedUrl(document: UploadedDocument) {
  const signedUrl = await createRemoteDocumentSignedUrl(document);

  if (!signedUrl) {
    return false;
  }

  const opened = window.open(signedUrl, "_blank", "noopener,noreferrer");
  return Boolean(opened);
}

export async function saveDocumentFile(file: File): Promise<UploadedDocument> {
  const document: UploadedDocument = {
    id: crypto.randomUUID(),
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: file.lastModified,
    uploadedAt: new Date().toISOString(),
    source: "local",
  };

  await withStore("readwrite", (store) =>
    store.put({
      ...document,
      blob: file,
    } satisfies StoredDocumentRecord),
  );

  return document;
}

async function loadLocalDocumentFile(id: string): Promise<File | null> {
  const stored = await withStore<StoredDocumentRecord | undefined>(
    "readonly",
    (store) => store.get(id),
  );

  if (!stored) {
    return null;
  }

  return new File([stored.blob], stored.name, {
    type: stored.type,
    lastModified: stored.lastModified,
  });
}

async function saveRemoteDocumentFile(
  file: File,
  applicationId: string,
  kind: DocumentKind,
): Promise<UploadedDocument> {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const session = await getSupabaseSession();

  if (!session) {
    throw new Error("No authenticated session is available.");
  }

  const documentId = crypto.randomUUID();
  const safeName = sanitizeFileName(file.name);
  const storagePath = `${session.user.id}/${applicationId}/${kind}/${documentId}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "application/octet-stream",
    });

  if (uploadError) {
    throw uploadError;
  }

  const remoteRow = {
    id: documentId,
    application_id: applicationId,
    kind,
    storage_bucket: STORAGE_BUCKET,
    storage_path: storagePath,
    file_name: file.name,
    mime_type: file.type || "application/octet-stream",
    size_bytes: file.size,
  };

  const { data, error } = await supabase
    .from("application_documents")
    .insert(remoteRow)
    .select(
      "id, file_name, size_bytes, mime_type, created_at, storage_bucket, storage_path",
    )
    .single();

  if (error) {
    await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
    throw error;
  }

  return toUploadedDocument(data as RemoteDocumentRow, file.lastModified);
}

function toUploadedDocument(
  document: RemoteDocumentRow,
  lastModified = Date.now(),
): UploadedDocument {
  return {
    id: document.id,
    name: document.file_name,
    size: document.size_bytes,
    type: document.mime_type,
    lastModified,
    uploadedAt: document.created_at,
    source: "remote",
    storageBucket: document.storage_bucket,
    storagePath: document.storage_path,
  };
}

export async function deleteStoredDocument(
  document: UploadedDocument | undefined,
): Promise<void> {
  if (!document?.id) {
    return;
  }

  if (isRemoteDocument(document) && supabase) {
    const bucket = document.storageBucket ?? STORAGE_BUCKET;
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

  await withStore("readwrite", (store) => store.delete(document.id));
}

export async function clearStoredDocuments(): Promise<void> {
  await withStore("readwrite", (store) => store.clear());
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

export async function downloadStoredDocument(
  document: UploadedDocument | undefined,
): Promise<boolean> {
  if (!document?.id) {
    return false;
  }

  if (isRemoteDocument(document) && supabase) {
    try {
      const proxyResponse = await requestRemoteDocumentProxy(
        document,
        "attachment",
      );

      if (proxyResponse) {
        if (!proxyResponse.ok) {
          return false;
        }

        const proxyBlob = await proxyResponse.blob();
        triggerDocumentDownload(proxyBlob, document.name);
        return true;
      }

      return downloadRemoteDocumentViaSignedUrl(document);
    } catch {
      return false;
    }
  }

  const file = await loadLocalDocumentFile(document.id);

  if (!file) {
    return false;
  }

  triggerDocumentDownload(file, document.name);
  return true;
}

export function viewLocalDocument(file: Blob): boolean {
  const url = URL.createObjectURL(file);
  const opened = window.open(url, "_blank", "noopener,noreferrer");

  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return Boolean(opened);
}

export async function viewStoredDocument(
  document: UploadedDocument | undefined,
): Promise<boolean> {
  if (!document?.id) {
    return false;
  }

  if (isRemoteDocument(document) && supabase) {
    try {
      const proxyResponse = await requestRemoteDocumentProxy(document, "inline");

      if (proxyResponse) {
        if (!proxyResponse.ok) {
          return false;
        }

        const proxyBlob = await proxyResponse.blob();
        return viewLocalDocument(proxyBlob);
      }

      return viewRemoteDocumentViaSignedUrl(document);
    } catch {
      return false;
    }
  }

  const file = await loadLocalDocumentFile(document.id);

  if (!file) {
    return false;
  }

  return viewLocalDocument(file);
}

export function formatFileSize(size: number | undefined): string | null {
  if (!size || size <= 0) {
    return null;
  }

  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
