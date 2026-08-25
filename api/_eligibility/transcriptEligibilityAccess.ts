import { isUcCreditAssessmentRequest } from "../../src/lib/ucCreditAssessmentContract.js";

type EligibilityAuthKind = "authenticated" | "open" | "unauthenticated";

export interface TranscriptEligibilityAccessError {
  code:
    | "ELIGIBILITY_NOT_CONFIGURED"
    | "ELIGIBILITY_UNAUTHORIZED"
    | "UC_CREDIT_ASSESSMENT_NOT_CONFIGURED"
    | "UC_CREDIT_ASSESSMENT_UNAUTHORIZED";
  message: string;
  status: 401 | 503;
}

/**
 * All hosted transcript processing is authenticated. Local development keeps
 * the shared auth helper's open mode so parser work remains possible without a
 * local Supabase stack.
 */
export function getTranscriptEligibilityAccessError(
  authKind: EligibilityAuthKind,
  request: Request,
  isDeployed: boolean,
): TranscriptEligibilityAccessError | null {
  const isUcCreditAssessment = isUcCreditAssessmentRequest(request);

  if (authKind === "open" && isDeployed) {
    return isUcCreditAssessment
      ? {
          code: "UC_CREDIT_ASSESSMENT_NOT_CONFIGURED",
          message: "Credit assessment authentication is not configured.",
          status: 503,
        }
      : {
          code: "ELIGIBILITY_NOT_CONFIGURED",
          message: "Transcript evaluation authentication is not configured.",
          status: 503,
        };
  }

  if (authKind === "unauthenticated") {
    return isUcCreditAssessment
      ? {
          code: "UC_CREDIT_ASSESSMENT_UNAUTHORIZED",
          message: "Sign in before completing a credit assessment.",
          status: 401,
        }
      : {
          code: "ELIGIBILITY_UNAUTHORIZED",
          message: "Sign in before reviewing transcript evidence.",
          status: 401,
        };
  }

  return null;
}
