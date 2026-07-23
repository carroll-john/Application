import { isUcCreditAssessmentRequest } from "../../src/lib/ucCreditAssessmentContract.js";

type EligibilityAuthKind = "authenticated" | "open" | "unauthenticated";

export function getUcCreditAssessmentAccessError(
  authKind: EligibilityAuthKind,
  request: Request,
  isDeployed: boolean,
) {
  if (!isUcCreditAssessmentRequest(request)) return null;

  if (authKind === "open" && isDeployed) {
    return {
      code: "UC_CREDIT_ASSESSMENT_NOT_CONFIGURED",
      message: "Credit assessment authentication is not configured.",
      status: 503,
    } as const;
  }

  if (authKind === "unauthenticated") {
    return {
      code: "UC_CREDIT_ASSESSMENT_UNAUTHORIZED",
      message: "Sign in before completing a credit assessment.",
      status: 401,
    } as const;
  }

  return null;
}
