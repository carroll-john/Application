import { normalizeTranscriptEligibilityAssessment } from "./normalize";
import { serializeTranscriptEligibilityContext } from "./contextSchema";
import type {
  TranscriptEligibilityAssessment,
  TranscriptEligibilityRequestContext,
} from "./types";
import { addUcCreditAssessmentFlow } from "../ucCreditAssessmentContract";

export class TranscriptEligibilityRequestError extends Error {
  code?: string;
  status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "TranscriptEligibilityRequestError";
    this.status = status;
    this.code = code;
  }
}

function parseErrorPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return { code: undefined, message: null };
  }

  const message =
    "error" in payload &&
    typeof payload.error === "string" &&
    payload.error.trim().length > 0
      ? payload.error.trim()
      : null;
  const code =
    "code" in payload &&
    typeof payload.code === "string" &&
    payload.code.trim().length > 0
      ? payload.code.trim()
      : undefined;

  return { code, message };
}

export async function evaluateTranscriptEligibility(
  file: File,
  context: TranscriptEligibilityRequestContext,
  options: {
    accessToken: string;
    ucCreditAssessment?: boolean;
  },
): Promise<TranscriptEligibilityAssessment> {
  const accessToken = options.accessToken.trim();

  if (!accessToken) {
    throw new TranscriptEligibilityRequestError(
      "Sign in before reviewing transcript evidence.",
      401,
      "ELIGIBILITY_UNAUTHORIZED",
    );
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("context", serializeTranscriptEligibilityContext(context));

  const url = options.ucCreditAssessment
    ? addUcCreditAssessmentFlow("/api/evaluate-transcript-eligibility")
    : "/api/evaluate-transcript-eligibility";
  const headers: HeadersInit = {
    authorization: `Bearer ${accessToken}`,
  };

  const response = await fetch(url, {
    body: formData,
    headers,
    method: "POST",
  });

  let payload: unknown;

  try {
    payload = (await response.json()) as unknown;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const { code, message } = parseErrorPayload(payload);
    throw new TranscriptEligibilityRequestError(
      message ?? "Unable to evaluate transcript eligibility right now.",
      response.status,
      code,
    );
  }

  return normalizeTranscriptEligibilityAssessment(payload);
}
