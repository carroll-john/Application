export const UC_CREDIT_ASSESSMENT_FLOW = "uc-credit-assessment";

export function addUcCreditAssessmentFlow(url: string) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}flow=${UC_CREDIT_ASSESSMENT_FLOW}`;
}

export function isUcCreditAssessmentRequest(request: Request) {
  return (
    new URL(request.url).searchParams.get("flow") ===
    UC_CREDIT_ASSESSMENT_FLOW
  );
}
