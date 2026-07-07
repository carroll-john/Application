/**
 * Eligibility Evaluate — Contract v1 (machine-checkable mirror).
 *
 * Single source of truth, in code, for the HTTP boundary between the app proxy
 * (`api/evaluate-transcript-eligibility.ts`) and the external eligibility service
 * (github.com/carroll-john/eligibility-service, `POST /api/evaluate`).
 *
 * Prose contract: docs/contracts/eligibility-evaluate.v1.md
 * Conformance test: api/_eligibility/contractV1.test.ts
 *
 * Change this file, the doc, and the test together. Any breaking change is a v2.
 */

export const ELIGIBILITY_CONTRACT_VERSION = "v1" as const;

/** The multipart/form-data part names the proxy sends, and the service requires. */
export const ELIGIBILITY_REQUEST_PARTS = ["file", "context"] as const;

/** Transcript MIME types accepted by both the app proxy and the external service. */
export const ELIGIBILITY_SUPPORTED_TRANSCRIPT_MIME_TYPES_V1 = [
  "application/msword",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "text/plain",
] as const;

/** Auth scheme used when ELIGIBILITY_SERVICE_TOKEN is configured. */
export const ELIGIBILITY_AUTH_SCHEME = "Bearer" as const;

/**
 * The four eligibility outcomes, listed in precedence order
 * (ineligible > conditionally_eligible > insufficient_data > eligible).
 */
export const ELIGIBILITY_OUTCOMES = [
  "eligible",
  "conditionally_eligible",
  "ineligible",
  "insufficient_data",
] as const;
export type EligibilityOutcome = (typeof ELIGIBILITY_OUTCOMES)[number];

/** Extracted-evidence groups the service returns and the app matcher consumes. */
export const ELIGIBILITY_EVIDENCE_GROUPS = [
  "applicantDetails",
  "studyDetails",
  "academicPerformance",
  "englishLanguageEvidence",
] as const;

/** Additive structured evidence fields accepted inside v1 evidence groups. */
export const ELIGIBILITY_ACADEMIC_PERFORMANCE_OPTIONAL_FIELDS_V1 = [
  "unitResults",
] as const;

/**
 * Top-level fields a v1 service response is required to include. Mirrors the service's
 * REQUIRED_RESPONSE_FIELDS; the service rejects an incomplete model response upstream.
 */
export const ELIGIBILITY_RESPONSE_REQUIRED_FIELDS_V1 = [
  "academicPerformance",
  "applicantDetails",
  "checkedAt",
  "confidence",
  "englishLanguageEvidence",
  "manualReviewRequired",
  "missingInformation",
  "outcome",
  "programCode",
  "programTitle",
  "recommendedNextStep",
  "rulesVersion",
  "serviceVersion",
  "studyDetails",
] as const;

export function isEligibilityOutcome(value: unknown): value is EligibilityOutcome {
  return (
    typeof value === "string" &&
    (ELIGIBILITY_OUTCOMES as readonly string[]).includes(value)
  );
}
