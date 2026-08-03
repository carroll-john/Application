import type { TranscriptEligibilityAssessment } from "./eligibility/types";
import {
  evaluateUcTranscriptCredit,
  type UcGovernedCourse,
} from "./assessment/ucGovernance";
import type { CreditEstimateResult } from "./assessment/types";
import type { UcCourseMatch } from "./ucRplAssessment";

export interface UcCreditAssessmentResult extends CreditEstimateResult {
  evidenceSummary: string;
}

export interface UcCreditAssessmentContext {
  approvedRulesVersion?: string;
  courses?: readonly UcGovernedCourse[];
  now?: Date;
}

function evidenceSummary(result: CreditEstimateResult) {
  if (result.potentialCreditPoints === null) {
    return result.manualReviewReasons[0] ??
      "UC will review your transcript before confirming whether credit may apply.";
  }

  const unitLabel =
    result.matchedTranscriptEvidence.length === 1 ? "unit" : "units";
  return `Based only on ${result.matchedTranscriptEvidence.length} mapped transcript ${unitLabel}. UC must confirm unit equivalence and any formal credit.`;
}

export function assessUcShortlistedCourseCredit(
  match: UcCourseMatch,
  transcriptAssessment: TranscriptEligibilityAssessment,
  context: UcCreditAssessmentContext = {},
): UcCreditAssessmentResult {
  const result = evaluateUcTranscriptCredit({
    approvedRulesVersion:
      context.approvedRulesVersion ??
      import.meta.env.VITE_UC_ASSESSMENT_APPROVED_RULES_VERSION ??
      "",
    assessment: transcriptAssessment,
    courseCode: match.course.code,
    courses: context.courses,
    now: context.now,
  });

  return { ...result, evidenceSummary: evidenceSummary(result) };
}

export function assessUcShortlistCredit(
  matches: UcCourseMatch[],
  transcriptAssessment: TranscriptEligibilityAssessment,
  context: UcCreditAssessmentContext = {},
) {
  return matches.map((match) =>
    assessUcShortlistedCourseCredit(match, transcriptAssessment, context),
  );
}

export async function resolveUcTranscriptAssessmentForApplication(options: {
  parserAssessment: Promise<TranscriptEligibilityAssessment> | null;
  startParserAssessment: () => Promise<TranscriptEligibilityAssessment>;
}) {
  const { parserAssessment, startParserAssessment } = options;
  const initialAssessment = parserAssessment ?? startParserAssessment();

  try {
    return await initialAssessment;
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return startParserAssessment();
  }
}

function extractedValue(
  field: { normalizedValue?: string; originalValue?: string } | undefined,
) {
  return field?.normalizedValue?.trim() || field?.originalValue?.trim() || "";
}

export function hasUcTranscriptStudyEvidence(
  assessment: TranscriptEligibilityAssessment,
) {
  return Boolean(
    extractedValue(assessment.extractedData.studyDetails?.programName) ||
      (assessment.extractedData.academicPerformance?.unitResults?.length ?? 0) > 0,
  );
}
