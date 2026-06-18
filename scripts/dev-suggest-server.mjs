#!/usr/bin/env node

import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

for (const envFile of [".env", ".env.local"]) {
  try {
    process.loadEnvFile(envFile);
  } catch {
    // Optional env file; ignore when absent.
  }
}

const host = process.env.SUGGEST_PROXY_HOST?.trim() || "127.0.0.1";
const port = Number(process.env.SUGGEST_PROXY_PORT || 4193);

if (!Number.isFinite(port) || port <= 0) {
  throw new Error("SUGGEST_PROXY_PORT must be a positive number.");
}

const { handleAddressSuggest, handleInstitutionSuggest } = await import(
  "../api/_suggest/proxy.ts"
);

function toRequestHeaders(nodeHeaders) {
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

function sendJson(response, status, body) {
  response.statusCode = status;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-methods", "GET,OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type,authorization");

  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }

  if (!request.url) {
    sendJson(response, 400, { error: "Missing request URL." });
    return;
  }

  const url = new URL(request.url, `http://${host}:${port}`);

  if (request.method === "GET" && url.pathname === "/healthz") {
    sendJson(response, 200, { ok: true });
    return;
  }

  try {
    let handlerResponse;

    if (url.pathname === "/api/suggest/institutions") {
      const handlerRequest = new Request(url.toString(), {
        headers: toRequestHeaders(request.headers),
        method: "GET",
      });
      handlerResponse = await handleInstitutionSuggest(handlerRequest);
    } else if (url.pathname === "/api/suggest/addresses") {
      const handlerRequest = new Request(url.toString(), {
        headers: toRequestHeaders(request.headers),
        method: "GET",
      });
      handlerResponse = await handleAddressSuggest(handlerRequest);
    } else {
      sendJson(response, 404, { error: "Not found." });
      return;
    }

    response.statusCode = handlerResponse.status;
    handlerResponse.headers.forEach((value, key) => {
      response.setHeader(key, value);
    });
    response.end(Buffer.from(await handlerResponse.arrayBuffer()));
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : "Suggest proxy failed.",
    });
  }
});

server.listen(port, host, () => {
  console.log(`Suggest proxy listening on http://${host}:${port}`);
  console.log(`Point SUGGEST_SERVICE_URL at suggest-service for live lookups.`);
});

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  // noop marker for direct execution
}
