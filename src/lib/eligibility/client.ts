import { normalizeTranscriptEligibilityAssessment } from "./normalize";
import { serializeTranscriptEligibilityContext } from "./contextSchema";
import type {
  TranscriptEligibilityAssessment,
  TranscriptEligibilityRequestContext,
} from "./types";

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
): Promise<TranscriptEligibilityAssessment> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("context", serializeTranscriptEligibilityContext(context));

  const response = await fetch("/api/evaluate-transcript-eligibility", {
    body: formData,
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

