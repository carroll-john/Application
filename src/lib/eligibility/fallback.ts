import type {
  TranscriptEligibilityAssessment,
  TranscriptEligibilityRequestContext,
} from "./types";

interface CreateInsufficientDataAssessmentOptions {
  context: TranscriptEligibilityRequestContext;
  reason: string;
}

export function createInsufficientDataAssessment({
  context,
  reason,
}: CreateInsufficientDataAssessmentOptions): TranscriptEligibilityAssessment {
  return {
    checkedAt: new Date().toISOString(),
    confidence: 0.4,
    extractedData: {},
    manualReviewRequired: true,
    missingInformation: [reason],
    outcome: "insufficient_data",
    programCode: context.courseCode,
    programTitle: context.courseTitle,
    recommendedNextStep:
      "Review transcript evidence manually or retry the evidence review once more evidence is available.",
    requirementsChecked: [
      {
        explanation: reason,
        id: "automatic-evaluation",
        reasonCode: "SERVICE_UNAVAILABLE",
        requirement: "Automatic transcript eligibility evaluation",
        status: "unknown",
      },
    ],
    rulesVersion: "v1",
    serviceVersion: "client-fallback",
  };
}
