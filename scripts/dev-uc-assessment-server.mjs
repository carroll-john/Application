#!/usr/bin/env node

import { createServer } from "node:http";
import {
  createAssessmentAdminClient,
  sha256,
} from "../api/_assessment/server.ts";
import activateAssessment from "../api/assessment/activate.ts";
import assessmentDocument from "../api/assessment/document.ts";
import evaluateAssessment from "../api/assessment/evaluate.ts";
import assessmentSession from "../api/assessment/session.ts";
import startAssessmentApplication from "../api/assessment/start-application.ts";
import parseCv from "../api/parse-cv.ts";
import { LOCAL_UC_ASSESSMENT_INVITATION_TOKEN } from "../src/lib/assessment/localPreviewToken.ts";
import { UC_ASSESSMENT_PARTNER_ID } from "../src/lib/assessment/ucGovernance.ts";

const host = process.env.UC_ASSESSMENT_HOST?.trim() || "127.0.0.1";
const port = Number(process.env.UC_ASSESSMENT_PORT || 4194);

if (!Number.isFinite(port) || port <= 0) {
  throw new Error("UC_ASSESSMENT_PORT must be a positive number.");
}

const handlers = new Map([
  ["/api/assessment/activate", activateAssessment],
  ["/api/assessment/document", assessmentDocument],
  ["/api/assessment/evaluate", evaluateAssessment],
  ["/api/assessment/session", assessmentSession],
  ["/api/assessment/start-application", startAssessmentApplication],
  ["/api/parse-cv", parseCv],
]);

function toHeaders(nodeHeaders) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(nodeHeaders)) {
    if (typeof value === "string") headers.set(key, value);
    if (Array.isArray(value)) headers.set(key, value.join(", "));
  }
  return headers;
}

async function invoke(handler, request) {
  if (handler && typeof handler.fetch === "function") {
    return handler.fetch(request);
  }
  if (typeof handler === "function") {
    return handler(request);
  }
  throw new Error("The local assessment route does not expose a request handler.");
}

const server = createServer(async (request, response) => {
  if (!request.url) {
    response.writeHead(400).end();
    return;
  }

  const url = new URL(request.url, `http://${host}:${port}`);
  if (request.method === "GET" && url.pathname === "/healthz") {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  const handler = handlers.get(url.pathname);
  if (!handler) {
    response.writeHead(404).end();
    return;
  }

  try {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;
    const handlerRequest = new Request(url, {
      body,
      duplex: "half",
      headers: toHeaders(request.headers),
      method: request.method || "GET",
    });
    const handlerResponse = await invoke(handler, handlerRequest);
    response.statusCode = handlerResponse.status;
    handlerResponse.headers.forEach((value, key) => response.setHeader(key, value));
    response.end(Buffer.from(await handlerResponse.arrayBuffer()));
  } catch (error) {
    response.statusCode = 500;
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Local assessment request failed.",
      }),
    );
  }
});

function isLocalSupabaseUrl(value) {
  if (!value) return false;
  try {
    const hostname = new URL(value).hostname;
    return hostname === "127.0.0.1" || hostname === "localhost";
  } catch {
    return false;
  }
}

async function ensureLocalTreatmentParticipant() {
  if (!isLocalSupabaseUrl(process.env.SUPABASE_URL)) return;

  const admin = createAssessmentAdminClient();
  const { error } = await admin.from("pilot_participants").upsert(
    {
      cohort: "treatment",
      disabled_at: null,
      email_hash: sha256("local-treatment-preview@invalid.example"),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      invitation_token_hash: sha256(LOCAL_UC_ASSESSMENT_INVITATION_TOKEN),
      partner_id: UC_ASSESSMENT_PARTNER_ID,
    },
    { onConflict: "invitation_token_hash" },
  );

  if (error) {
    throw new Error(
      `Could not prepare the local treatment participant: ${error.message}`,
    );
  }
}

await ensureLocalTreatmentParticipant();

server.listen(port, host, () => {
  process.stdout.write(`uc-assessment-api listening on http://${host}:${port}\n`);
});

function shutdown(signal) {
  process.stdout.write(`\nReceived ${signal}, stopping uc-assessment-api...\n`);
  server.close(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
