import { getDocumentParserConfig, type ParseableDocumentKind } from "./documentParserRegistry";
import { supabase } from "./supabase";

export class DocumentParserRequestError extends Error {
  code?: string;
  status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "DocumentParserRequestError";
    this.status = status;
    this.code = code;
  }
}

export class CvParserRequestError extends DocumentParserRequestError {
  constructor(message: string, status: number, code?: string) {
    super(message, status, code);
    this.name = "CvParserRequestError";
  }
}

function parseErrorPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return { code: undefined, message: null };
  }

  const message =
    "error" in payload &&
    typeof payload.error === "string" &&
    payload.error.trim()
      ? payload.error
      : null;
  const code =
    "code" in payload &&
    typeof payload.code === "string" &&
    payload.code.trim()
      ? payload.code
      : undefined;

  return { code, message };
}

function isLocalhostRuntime() {
  if (typeof window === "undefined") {
    return false;
  }

  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

async function getAccessToken() {
  if (!supabase) {
    return null;
  }

  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function requestParseDocumentRoute(
  apiPath: string,
  localFallbackUrl: string | undefined,
  formData: FormData,
) {
  const accessToken = await getAccessToken();
  const headers: HeadersInit = {};

  if (accessToken) {
    headers.authorization = `Bearer ${accessToken}`;
  }

  const requestInit: RequestInit = {
    body: formData,
    headers,
    method: "POST",
  };

  const primaryResponse = await fetch(apiPath, requestInit);

  if (primaryResponse.status !== 404 || !isLocalhostRuntime() || !localFallbackUrl) {
    return primaryResponse;
  }

  return fetch(localFallbackUrl, requestInit);
}

export async function requestParseDocument<TDraft>(
  file: File,
  kind: ParseableDocumentKind,
): Promise<TDraft> {
  const config = getDocumentParserConfig(kind);

  if (!config) {
    throw new DocumentParserRequestError(
      `No parser is registered for document kind "${kind}".`,
      400,
      "DOCUMENT_PARSER_UNKNOWN_KIND",
    );
  }

  const formData = new FormData();
  formData.append("file", file);

  const response = await requestParseDocumentRoute(
    config.apiPath,
    config.localFallbackUrl,
    formData,
  );

  let payload: unknown;

  try {
    payload = (await response.json()) as unknown;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const { code, message } = parseErrorPayload(payload);

    throw new DocumentParserRequestError(
      message ?? config.errorFallbackMessage,
      response.status,
      code,
    );
  }

  return config.normalizeResponse(payload) as TDraft;
}
