export type NodeRequestHeaders = Record<string, string | string[] | undefined>;

export type NodeRequestLike = AsyncIterable<unknown> & {
  headers: NodeRequestHeaders;
  method?: string;
  url?: string;
};

export type NodeResponseLike = {
  end: (chunk?: Uint8Array | string) => void;
  setHeader: (name: string, value: string) => void;
  statusCode: number;
};

interface HandleApiRequestOptions {
  defaultPath: string;
  endHeadWithoutBody?: boolean;
  handleWebRequest: (request: Request) => Promise<Response> | Response;
  origin?: string | ((headers: Headers) => string);
  unsupportedResponse: () => Response;
}

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
  const chunks: Uint8Array[] = [];

  for await (const chunk of nodeRequest) {
    if (chunk instanceof Uint8Array) {
      chunks.push(chunk);
      continue;
    }

    if (typeof chunk === "string") {
      chunks.push(new TextEncoder().encode(chunk));
      continue;
    }

    if (chunk instanceof ArrayBuffer) {
      chunks.push(new Uint8Array(chunk));
    }
  }

  if (chunks.length === 0) {
    return undefined;
  }

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;

  chunks.forEach((chunk) => {
    combined.set(chunk, offset);
    offset += chunk.length;
  });

  return combined;
}

function resolveOrigin(headers: Headers, origin?: HandleApiRequestOptions["origin"]) {
  if (typeof origin === "string") {
    return origin;
  }

  if (typeof origin === "function") {
    return origin(headers);
  }

  const host = headers.get("x-forwarded-host") || headers.get("host") || "localhost";
  const protocol = headers.get("x-forwarded-proto") || "https";
  return `${protocol}://${host}`;
}

async function handleNodeRequest(
  nodeRequest: NodeRequestLike,
  nodeResponse: NodeResponseLike,
  options: HandleApiRequestOptions,
) {
  const method = (nodeRequest.method || "GET").toUpperCase();
  const headers = toWebHeaders(nodeRequest.headers || {});
  const pathname = nodeRequest.url || options.defaultPath;
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
    new URL(pathname, resolveOrigin(headers, options.origin)).toString(),
    requestInit,
  );
  const webResponse = await options.handleWebRequest(webRequest);

  nodeResponse.statusCode = webResponse.status;
  webResponse.headers.forEach((value, key) => {
    nodeResponse.setHeader(key, value);
  });

  if (method === "HEAD" && options.endHeadWithoutBody) {
    nodeResponse.end();
    return;
  }

  const responseBody = new Uint8Array(await webResponse.arrayBuffer());
  nodeResponse.end(responseBody);
}

export async function handleApiRequest(
  request: Request | NodeRequestLike,
  response: NodeResponseLike | undefined,
  options: HandleApiRequestOptions,
) {
  if (isWebRequest(request)) {
    return options.handleWebRequest(request);
  }

  if (response) {
    await handleNodeRequest(request as NodeRequestLike, response, options);
    return;
  }

  return options.unsupportedResponse();
}
