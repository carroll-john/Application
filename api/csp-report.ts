import { createRateLimiter } from "./_shared/rateLimiter";
import {
  handleApiRequest,
  type NodeRequestLike,
  type NodeResponseLike,
} from "./_shared/nodeWebHandler";

const NO_STORE_HEADERS = {
  "cache-control": "no-store, max-age=0",
  pragma: "no-cache",
};

const MAX_LOG_FIELD_LENGTH = 512;
const SYNTHETIC_BLOCKED_URI_HOSTS = new Set(["example-cdn.test"]);

// Best-effort per-instance burst limiter. CSP reporters retry on 5xx but
// silently drop 204s, so silent-drop is preferred over 429.
const cspReportRateLimiter = createRateLimiter({
  max: 60,
  windowMs: 60_000,
});

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...NO_STORE_HEADERS,
      "content-type": "application/json; charset=utf-8",
    },
    status,
  });
}

function trimLogValue(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.length <= MAX_LOG_FIELD_LENGTH) {
    return trimmed;
  }

  return `${trimmed.slice(0, MAX_LOG_FIELD_LENGTH)}…`;
}

function normalizeUri(uri: unknown) {
  const normalized = trimLogValue(uri);
  if (!normalized) {
    return null;
  }

  try {
    const parsed = new URL(normalized);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return normalized;
  }
}

function pickViolationDetails(value: Record<string, unknown>) {
  return {
    blockedUri: normalizeUri(value["blocked-uri"]),
    columnNumber: value["column-number"] ?? null,
    disposition: trimLogValue(value.disposition),
    documentUri: normalizeUri(value["document-uri"]),
    effectiveDirective: trimLogValue(value["effective-directive"]),
    lineNumber: value["line-number"] ?? null,
    originalPolicy: trimLogValue(value["original-policy"]),
    referrer: normalizeUri(value.referrer),
    scriptSample: trimLogValue(value["script-sample"]),
    sourceFile: normalizeUri(value["source-file"]),
    statusCode: value["status-code"] ?? null,
    violatedDirective: trimLogValue(value["violated-directive"]),
  };
}

function parseViolationPayload(payload: unknown) {
  const violationRecords: Array<Record<string, unknown>> = [];

  if (Array.isArray(payload)) {
    payload.forEach((item) => {
      if (!item || typeof item !== "object") {
        return;
      }

      const reportBody = (item as Record<string, unknown>).body;
      if (reportBody && typeof reportBody === "object") {
        violationRecords.push(reportBody as Record<string, unknown>);
      }
    });
  } else if (payload && typeof payload === "object") {
    const payloadRecord = payload as Record<string, unknown>;
    const legacyReport = payloadRecord["csp-report"];
    const reportBody = payloadRecord.body;

    if (legacyReport && typeof legacyReport === "object") {
      violationRecords.push(legacyReport as Record<string, unknown>);
    } else if (reportBody && typeof reportBody === "object") {
      violationRecords.push(reportBody as Record<string, unknown>);
    } else {
      violationRecords.push(payloadRecord);
    }
  }

  return violationRecords.map((record) => pickViolationDetails(record));
}

function extractHostname(uri: string | null) {
  if (!uri) {
    return null;
  }

  try {
    return new URL(uri).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isSyntheticTestViolation(report: { blockedUri: string | null }) {
  const blockedUriHost = extractHostname(report.blockedUri);
  return blockedUriHost ? SYNTHETIC_BLOCKED_URI_HOSTS.has(blockedUriHost) : false;
}

async function parseJsonSafely(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function extractRequestPath(request: Request) {
  try {
    const parsed = new URL(request.url);
    return parsed.pathname;
  } catch {
    return request.url;
  }
}

async function handleWebRequest(request: Request) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: NO_STORE_HEADERS,
      status: 204,
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(
      {
        code: "CSP_REPORT_METHOD_NOT_ALLOWED",
        error: "Method not allowed.",
      },
      405,
    );
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  const clientIp = forwardedFor?.split(",")[0]?.trim() ?? null;

  if (clientIp && cspReportRateLimiter.isLimited(`ip:${clientIp}`)) {
    return new Response(null, {
      headers: NO_STORE_HEADERS,
      status: 204,
    });
  }

  const payload = await parseJsonSafely(request);
  const violations = parseViolationPayload(payload);
  const realViolations = violations.filter(
    (violation) => !isSyntheticTestViolation(violation),
  );

  if (realViolations.length === 0) {
    return new Response(null, {
      headers: NO_STORE_HEADERS,
      status: 204,
    });
  }

  console.warn(
    "[csp-report]",
    JSON.stringify({
      contentType: trimLogValue(request.headers.get("content-type")),
      ip: clientIp,
      path: extractRequestPath(request),
      reports: realViolations,
    }),
  );

  return new Response(null, {
    headers: NO_STORE_HEADERS,
    status: 204,
  });
}

export default async function handler(
  request: Request | NodeRequestLike,
  response?: NodeResponseLike,
) {
  return handleApiRequest(request, response, {
    defaultPath: "/api/csp-report",
    endHeadWithoutBody: true,
    handleWebRequest,
    origin: "https://application-prototype.local",
    unsupportedResponse: () =>
      jsonResponse(
        {
          code: "CSP_REPORT_UNSUPPORTED_REQUEST_SHAPE",
          error: "Unsupported request shape.",
        },
        500,
      ),
  });
}
