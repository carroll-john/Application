import type { EligibilityRequirementStatus } from "./types";

export interface EligibilityFeedbackPayload {
  requirementId: string;
  requirementSourceText?: string;
  originalStatus: EligibilityRequirementStatus;
  overrideStatus: EligibilityRequirementStatus;
  reason?: string;
  courseCode?: string;
  courseTitle?: string;
  /** Durable machine reason behind the disputed automated status, for labelled-data analysis. */
  reasonCode?: string;
  modelId?: string;
  promptVersion?: string;
  rulesVersion?: string;
  schemaVersion?: string;
  serviceVersion?: string;
}

/**
 * Posts a labelled override to the eligibility-feedback API. Treat failures as non-fatal so the user
 * is never blocked by an observability outage.
 */
export async function submitEligibilityFeedback(
  payload: EligibilityFeedbackPayload,
): Promise<{ ok: boolean }> {
  try {
    const response = await fetch("/api/capture-eligibility-feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    return { ok: response.ok };
  } catch {
    return { ok: false };
  }
}
