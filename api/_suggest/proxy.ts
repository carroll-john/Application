import {
  SUGGEST_ADDRESS_RESOLVE_PATH,
  SUGGEST_ADDRESS_SUGGEST_PATH,
  SUGGEST_AUTH_SCHEME,
  SUGGEST_INSTITUTION_SUGGEST_PATH,
} from "./contractV1.js";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function getServiceBaseUrl() {
  return trimTrailingSlash(process.env.SUGGEST_SERVICE_URL?.trim() ?? "");
}

function getServiceToken() {
  return process.env.SUGGEST_SERVICE_TOKEN?.trim() ?? "";
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
    status,
  });
}

function notConfiguredResponse() {
  return jsonResponse(
    {
      code: "SUGGEST_SERVICE_NOT_CONFIGURED",
      error: "Suggest service URL is not configured.",
    },
    404,
  );
}

async function proxySuggestRequest(pathname: string, requestUrl: string) {
  const baseUrl = getServiceBaseUrl();

  if (!baseUrl) {
    return notConfiguredResponse();
  }

  const incomingUrl = new URL(requestUrl);
  const targetUrl = new URL(`${baseUrl}${pathname}`);
  targetUrl.search = incomingUrl.search;

  const headers = new Headers({ accept: "application/json" });
  const token = getServiceToken();

  if (token) {
    headers.set("authorization", `${SUGGEST_AUTH_SCHEME} ${token}`);
  }

  const upstream = await fetch(targetUrl.toString(), {
    headers,
    method: "GET",
  });

  const body = await upstream.text();

  return new Response(body, {
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json",
      "cache-control": "no-store",
    },
    status: upstream.status,
  });
}

export async function handleInstitutionSuggest(request: Request) {
  if (request.method !== "GET") {
    return jsonResponse({ code: "METHOD_NOT_ALLOWED", error: "GET only." }, 405);
  }

  return proxySuggestRequest(SUGGEST_INSTITUTION_SUGGEST_PATH, request.url);
}

export async function handleAddressSuggest(request: Request) {
  if (request.method !== "GET") {
    return jsonResponse({ code: "METHOD_NOT_ALLOWED", error: "GET only." }, 405);
  }

  const url = new URL(request.url);
  const resolve = url.searchParams.get("resolve");

  if (resolve === "1" || resolve === "true") {
    url.searchParams.delete("resolve");
    const placeId = url.searchParams.get("placeId");

    if (!placeId) {
      return jsonResponse(
        { code: "SUGGEST_INVALID_PLACE_ID", error: "placeId is required." },
        400,
      );
    }

    return proxySuggestRequest(SUGGEST_ADDRESS_RESOLVE_PATH, url.toString());
  }

  return proxySuggestRequest(SUGGEST_ADDRESS_SUGGEST_PATH, request.url);
}

const institutionHandler = {
  async fetch(request: Request) {
    return handleInstitutionSuggest(request);
  },
};

const addressHandler = {
  async fetch(request: Request) {
    return handleAddressSuggest(request);
  },
};

export default institutionHandler;
export { addressHandler };
