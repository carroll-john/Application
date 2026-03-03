#!/usr/bin/env node

import { createServer } from "node:http";

const host = process.env.CV_PARSER_HOST?.trim() || "127.0.0.1";
const port = Number(process.env.CV_PARSER_PORT || 4190);

if (!Number.isFinite(port) || port <= 0) {
  throw new Error("CV_PARSER_PORT must be a positive number.");
}

const { default: parseCvHandler } = await import("../api/parse-cv.ts");

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
  response.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
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

  if (url.pathname !== "/api/parse-cv") {
    sendJson(response, 404, { error: "Not found." });
    return;
  }

  try {
    const chunks = [];
    for await (const chunk of request) {
      chunks.push(chunk);
    }

    const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;
    const handlerRequest = new Request(url.toString(), {
      body,
      duplex: "half",
      headers: toRequestHeaders(request.headers),
      method: request.method || "GET",
    });

    const handlerResponse = await parseCvHandler(handlerRequest);

    response.statusCode = handlerResponse.status;
    handlerResponse.headers.forEach((value, key) => {
      response.setHeader(key, value);
    });

    const payload = await handlerResponse.arrayBuffer();
    response.end(Buffer.from(payload));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unhandled parser server error.";
    sendJson(response, 500, { error: message });
  }
});

server.listen(port, host, () => {
  process.stdout.write(`cv-parser-api listening on http://${host}:${port}\n`);
});

function shutdown(signal) {
  process.stdout.write(`\nReceived ${signal}, stopping cv-parser-api...\n`);
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
