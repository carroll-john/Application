import { createClient } from "@supabase/supabase-js";

interface RemoteDocumentRow {
  id: string;
  file_name: string;
  mime_type: string;
  storage_bucket: string;
  storage_path: string;
}

type DocumentDisposition = "attachment" | "inline";

type DocumentProxyErrorCode =
  | "DOCUMENT_PROXY_METHOD_NOT_ALLOWED"
  | "DOCUMENT_PROXY_NOT_CONFIGURED"
  | "DOCUMENT_PROXY_UNAUTHORIZED"
  | "DOCUMENT_PROXY_DOCUMENT_ID_REQUIRED"
  | "DOCUMENT_PROXY_FORBIDDEN_OR_NOT_FOUND"
  | "DOCUMENT_PROXY_UNEXPECTED_FAILURE";

const DOCUMENT_PROXY_ERROR_DEFINITIONS: Record<
  DocumentProxyErrorCode,
  { message: string; status: number }
> = {
  DOCUMENT_PROXY_METHOD_NOT_ALLOWED: {
    message: "Method not allowed.",
    status: 405,
  },
  DOCUMENT_PROXY_NOT_CONFIGURED: {
    message: "Document delivery proxy is not configured on this deployment.",
    status: 503,
  },
  DOCUMENT_PROXY_UNAUTHORIZED: {
    message: "Unauthorized.",
    status: 401,
  },
  DOCUMENT_PROXY_DOCUMENT_ID_REQUIRED: {
    message: "A documentId query parameter is required.",
    status: 400,
  },
  DOCUMENT_PROXY_FORBIDDEN_OR_NOT_FOUND: {
    message: "Document not found.",
    status: 404,
  },
  DOCUMENT_PROXY_UNEXPECTED_FAILURE: {
    message: "Unexpected document delivery failure.",
    status: 500,
  },
};

const SENSITIVE_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "application/octet-stream",
]);

const NO_STORE_HEADERS = {
  "cache-control": "private, no-store, no-cache, max-age=0, must-revalidate",
  expires: "0",
  pragma: "no-cache",
  "surrogate-control": "no-store",
  vary: "authorization",
  "x-content-type-options": "nosniff",
  "x-document-proxy": "1",
};

function parseDisposition(value: string | null): DocumentDisposition {
  return value?.trim().toLowerCase() === "inline" ? "inline" : "attachment";
}

function resolveDisposition(
  requestedDisposition: DocumentDisposition,
  mimeType: string,
): DocumentDisposition {
  return SENSITIVE_MIME_TYPES.has(mimeType.toLowerCase())
    ? "attachment"
    : requestedDisposition;
}

function sanitizeFileNameForHeader(fileName: string) {
  const safeName = fileName
    .replace(/[\u0000-\u001f\u007f-\u009f/\\]/g, "_")
    .replace(/"/g, "'")
    .trim();

  return safeName || "document";
}

function encodeFileNameUtf8(fileName: string) {
  return encodeURIComponent(fileName).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function buildContentDisposition(
  disposition: DocumentDisposition,
  fileName: string,
) {
  const sanitizedFileName = sanitizeFileNameForHeader(fileName);
  const utf8FileName = encodeFileNameUtf8(fileName || sanitizedFileName);

  return `${disposition}; filename="${sanitizedFileName}"; filename*=UTF-8''${utf8FileName}`;
}

function getBearerToken(headers: Headers) {
  const authorization = headers.get("authorization")?.trim() ?? "";

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = authorization.slice("bearer ".length).trim();
  return token || null;
}

function getSupabaseProjectConfig() {
  const url =
    process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim();
  const anonKey =
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    return null;
  }

  return { anonKey, url };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...NO_STORE_HEADERS,
      "content-type": "application/json; charset=utf-8",
    },
    status,
  });
}

function errorResponse(code: DocumentProxyErrorCode) {
  const definition = DOCUMENT_PROXY_ERROR_DEFINITIONS[code];

  return jsonResponse(
    {
      code,
      error: definition.message,
    },
    definition.status,
  );
}

async function handleWebRequest(request: Request) {
  try {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return errorResponse("DOCUMENT_PROXY_METHOD_NOT_ALLOWED");
    }

    const supabaseConfig = getSupabaseProjectConfig();

    if (!supabaseConfig) {
      return errorResponse("DOCUMENT_PROXY_NOT_CONFIGURED");
    }

    const accessToken = getBearerToken(request.headers);

    if (!accessToken) {
      return errorResponse("DOCUMENT_PROXY_UNAUTHORIZED");
    }

    const requestUrl = new URL(request.url);
    const documentId = requestUrl.searchParams.get("documentId")?.trim();

    if (!documentId) {
      return errorResponse("DOCUMENT_PROXY_DOCUMENT_ID_REQUIRED");
    }

    const requestedDisposition = parseDisposition(
      requestUrl.searchParams.get("disposition"),
    );

    const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

    const { data: userData, error: userError } =
      await supabase.auth.getUser(accessToken);

    if (userError || !userData.user) {
      return errorResponse("DOCUMENT_PROXY_UNAUTHORIZED");
    }

    const { data: documentRow, error: documentError } = await supabase
      .from("application_documents")
      .select("id, file_name, mime_type, storage_bucket, storage_path")
      .eq("id", documentId)
      .maybeSingle();

    if (documentError || !documentRow) {
      return errorResponse("DOCUMENT_PROXY_FORBIDDEN_OR_NOT_FOUND");
    }

    const typedDocumentRow = documentRow as RemoteDocumentRow;
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from(typedDocumentRow.storage_bucket)
      .download(typedDocumentRow.storage_path);

    if (downloadError || !fileBlob) {
      return errorResponse("DOCUMENT_PROXY_FORBIDDEN_OR_NOT_FOUND");
    }

    const mimeType = (
      typedDocumentRow.mime_type ||
      fileBlob.type ||
      "application/octet-stream"
    ).trim();
    const responseHeaders = new Headers(NO_STORE_HEADERS);

    responseHeaders.set(
      "content-disposition",
      buildContentDisposition(
        resolveDisposition(requestedDisposition, mimeType),
        typedDocumentRow.file_name,
      ),
    );
    responseHeaders.set("content-type", mimeType || "application/octet-stream");
    responseHeaders.set("cross-origin-resource-policy", "same-origin");

    if (fileBlob.size > 0) {
      responseHeaders.set("content-length", String(fileBlob.size));
    }

    if (request.method === "HEAD") {
      return new Response(null, {
        headers: responseHeaders,
        status: 200,
      });
    }

    return new Response(fileBlob, {
      headers: responseHeaders,
      status: 200,
    });
  } catch {
    return errorResponse("DOCUMENT_PROXY_UNEXPECTED_FAILURE");
  }
}

type NodeRequestHeaders = Record<string, string | string[] | undefined>;

type NodeRequestLike = AsyncIterable<unknown> & {
  headers: NodeRequestHeaders;
  method?: string;
  url?: string;
};

type NodeResponseLike = {
  end: (body?: Uint8Array | string) => void;
  setHeader: (name: string, value: string) => void;
  statusCode: number;
};

function isWebRequest(value: unknown): value is Request {
  return Boolean(
    value &&
      typeof value === "object" &&
      "headers" in (value as Request) &&
      typeof (value as Request).headers?.get === "function" &&
      typeof (value as Request).method === "string",
  );
}

function toWebHeaders(nodeHeaders: NodeRequestHeaders) {
  const headers = new Headers();

  for (const [key, value] of Object.entries(nodeHeaders)) {
    if (typeof value === "string") {
      headers.set(key, value);
      continue;
    }

    if (Array.isArray(value)) {
      headers.set(key, value.join(", "));
    }
  }

  return headers;
}

function supportsRequestBody(method: string) {
  return method !== "GET" && method !== "HEAD";
}

async function readNodeRequestBody(nodeRequest: NodeRequestLike) {
  const chunks: Buffer[] = [];

  for await (const chunk of nodeRequest) {
    if (typeof chunk === "string") {
      chunks.push(Buffer.from(chunk));
      continue;
    }

    if (chunk instanceof Uint8Array) {
      chunks.push(Buffer.from(chunk));
      continue;
    }

    if (chunk instanceof ArrayBuffer) {
      chunks.push(Buffer.from(chunk));
    }
  }

  return chunks.length > 0 ? Buffer.concat(chunks) : undefined;
}

async function handleNodeRequest(
  nodeRequest: NodeRequestLike,
  nodeResponse: NodeResponseLike,
) {
  const method = (nodeRequest.method || "GET").toUpperCase();
  const headers = toWebHeaders(nodeRequest.headers || {});
  const pathname = nodeRequest.url || "/api/document-delivery";
  const body = supportsRequestBody(method)
    ? await readNodeRequestBody(nodeRequest)
    : undefined;

  const requestInit: RequestInit & { duplex?: "half" } = {
    headers,
    method,
  };

  if (supportsRequestBody(method) && body) {
    requestInit.body = body;
    requestInit.duplex = "half";
  }

  const webRequest = new Request(
    `https://application-prototype.local${pathname}`,
    requestInit,
  );
  const webResponse = await handleWebRequest(webRequest);

  nodeResponse.statusCode = webResponse.status;
  webResponse.headers.forEach((value, key) => {
    nodeResponse.setHeader(key, value);
  });

  if (method === "HEAD") {
    nodeResponse.end();
    return;
  }

  const responseBody = new Uint8Array(await webResponse.arrayBuffer());
  nodeResponse.end(responseBody);
}

export default async function handler(
  request: Request | NodeRequestLike,
  response?: NodeResponseLike,
) {
  if (isWebRequest(request)) {
    return handleWebRequest(request);
  }

  if (response) {
    await handleNodeRequest(request as NodeRequestLike, response);
    return;
  }

  return errorResponse("DOCUMENT_PROXY_UNEXPECTED_FAILURE");
}
