import { supabase } from "../supabase";

export const REMOTE_STORAGE_BUCKET = "application-documents";
const REMOTE_DOCUMENT_PROXY_PATH = "/api/document-delivery";
const REMOTE_DOCUMENT_PROXY_IDENTIFIER_HEADER = "x-document-proxy";

export type RemoteDocumentDisposition = "attachment" | "inline";

export async function getSupabaseSession() {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return data.session;
}

export function isLocalhostRuntime() {
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

export async function requestRemoteDocumentProxy(
  document: {
    id: string;
    storageBucket?: string;
    storagePath?: string;
  },
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

export async function createRemoteDocumentSignedUrl(document: {
  name: string;
  storageBucket?: string;
  storagePath?: string;
}): Promise<string | null> {
  if (!document.storagePath || !supabase) {
    return null;
  }

  const { data, error } = await supabase.storage
    .from(document.storageBucket ?? REMOTE_STORAGE_BUCKET)
    .createSignedUrl(document.storagePath, 60);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

async function downloadRemoteDocumentViaSignedUrl(document: {
  name: string;
  storageBucket?: string;
  storagePath?: string;
}) {
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

async function viewRemoteDocumentViaSignedUrl(document: {
  name: string;
  storageBucket?: string;
  storagePath?: string;
}) {
  const signedUrl = await createRemoteDocumentSignedUrl(document);

  if (!signedUrl) {
    return false;
  }

  const opened = window.open(signedUrl, "_blank", "noopener,noreferrer");
  return Boolean(opened);
}

export async function loadRemoteDocumentFile(document: {
  id: string;
  name: string;
  type: string;
  lastModified: number;
  storageBucket?: string;
  storagePath?: string;
}): Promise<File | null> {
  try {
    const proxyResponse = await requestRemoteDocumentProxy(document, "attachment");

    if (proxyResponse) {
      if (!proxyResponse.ok) {
        throw new Error("Unable to load the remote document.");
      }

      const blob = await proxyResponse.blob();
      return new File([blob], document.name, {
        type: document.type || blob.type || "application/octet-stream",
        lastModified: document.lastModified || Date.now(),
      });
    }
  } catch (error) {
    if (!isLocalhostRuntime()) {
      throw error;
    }
  }

  const signedUrl = await createRemoteDocumentSignedUrl(document);

  if (!signedUrl) {
    return null;
  }

  const response = await fetch(signedUrl, { method: "GET" });

  if (!response.ok) {
    throw new Error("Unable to load the remote document.");
  }

  const blob = await response.blob();
  return new File([blob], document.name, {
    type: document.type || blob.type || "application/octet-stream",
    lastModified: document.lastModified || Date.now(),
  });
}

export async function downloadStoredRemoteDocument(document: {
  id: string;
  name: string;
  storageBucket?: string;
  storagePath?: string;
}): Promise<boolean> {
  if (!supabase) {
    return false;
  }

  try {
    const proxyResponse = await requestRemoteDocumentProxy(document, "attachment");

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

export function viewLocalDocument(blob: Blob): boolean {
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, "_blank", "noopener,noreferrer");

  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return Boolean(opened);
}

export async function viewStoredRemoteDocument(document: {
  id: string;
  name: string;
  storageBucket?: string;
  storagePath?: string;
}): Promise<boolean> {
  if (!supabase) {
    return false;
  }

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

export function formatFileSize(size: number | undefined): string | null {
  if (!size || size <= 0) {
    return null;
  }

  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
