import { applyDeterministicEligibilityRules } from "../../src/lib/eligibility/deterministicRules.js";
import { aggregateOutcome, evaluateRequirements } from "../../src/lib/eligibility/matcher.js";
import type {
  EligibilityRequirementCheck,
  TranscriptExtractedData,
} from "../../src/lib/eligibility/types.js";
import type { TranscriptEligibilityRequestContext } from "./context.js";

/** Shapes an eligibility assessment payload from upstream/LLM output + request context. */

export function buildFallbackResponse(
  context: TranscriptEligibilityRequestContext,
  reason?:
    | string
    | {
        detail: string;
        title: string;
      },
) {
  const fallbackReason =
    typeof reason === "string"
      ? reason
      : reason?.detail ??
        "External eligibility service is not configured in this environment.";

  return {
    checkedAt: new Date().toISOString(),
    confidence: 0.45,
    manualReviewRequired: true,
    missingInformation: [
      fallbackReason,
      "A full transcript extraction and eligibility evaluation could not be completed automatically.",
    ],
    outcome: "insufficient_data",
    programCode: context.courseCode,
    programTitle: context.courseTitle,
    recommendedNextStep:
      "Route this application for manual admissions review or configure the eligibility service endpoint.",
    requirementsChecked: [
      {
        explanation:
          "Transcript evidence was saved, but an external evaluation service response was unavailable.",
        id: "service-availability",
        requirement: "Automated transcript eligibility evaluation availability",
        status: "unknown",
      },
    ],
    rulesVersion: "v1",
    serviceVersion: "fallback-local",
    applicantDetails: {
      institutionName: {
        confidence: context.institution ? 0.8 : 0.2,
        normalizedValue: context.institution,
        originalValue: context.institution,
      },
    },
    studyDetails: {
      completionStatus: {
        confidence: typeof context.completed === "boolean" ? 0.8 : 0.3,
        normalizedValue:
          typeof context.completed === "boolean"
            ? context.completed
              ? "completed"
              : "in_progress_or_not_completed"
            : undefined,
        originalValue:
          typeof context.completed === "boolean"
            ? context.completed
              ? "completed"
              : "not completed"
            : undefined,
      },
      highestEducationLevel: {
        confidence: context.level ? 0.75 : 0.25,
        normalizedValue: context.level,
        originalValue: context.level,
      },
    },
  };
}

function extractEvidence(assessment: Record<string, unknown>): TranscriptExtractedData {
  // The transcript-eligibility service / LLM produces evidence groups directly on the assessment.
  // The matcher consumes a TranscriptExtractedData shape with the same group names, so we coerce
  // by reference rather than copy.
  const ev: TranscriptExtractedData = {};
  if (assessment.applicantDetails && typeof assessment.applicantDetails === "object") {
    ev.applicantDetails = assessment.applicantDetails as TranscriptExtractedData["applicantDetails"];
  }
  if (assessment.studyDetails && typeof assessment.studyDetails === "object") {
    ev.studyDetails = assessment.studyDetails as TranscriptExtractedData["studyDetails"];
  }
  if (assessment.academicPerformance && typeof assessment.academicPerformance === "object") {
    ev.academicPerformance =
      assessment.academicPerformance as TranscriptExtractedData["academicPerformance"];
  }
  if (
    assessment.englishLanguageEvidence &&
    typeof assessment.englishLanguageEvidence === "object"
  ) {
    ev.englishLanguageEvidence =
      assessment.englishLanguageEvidence as TranscriptExtractedData["englishLanguageEvidence"];
  }
  return ev;
}

function applyRequirementsMatcher(
  assessment: Record<string, unknown>,
  context: TranscriptEligibilityRequestContext,
): Record<string, unknown> {
  const requirements = context.requirements ?? [];
  const evidence = extractEvidence(assessment);
  const checks: EligibilityRequirementCheck[] = evaluateRequirements(
    requirements,
    evidence,
    context,
  );
  const { outcome, manualReviewRequired } = aggregateOutcome(checks);

  const patched: Record<string, unknown> = { ...assessment };
  patched.requirementsChecked = checks;
  patched.outcome = outcome;
  patched.manualReviewRequired = manualReviewRequired;

  const missingFromUnknown = checks
    .filter((check) => check.status === "unknown")
    .map((check) => check.explanation);
  const existingMissing = Array.isArray(patched.missingInformation)
    ? patched.missingInformation.filter((item): item is string => typeof item === "string")
    : [];
  patched.missingInformation = Array.from(new Set([...existingMissing, ...missingFromUnknown]));

  patched.rulesVersion =
    typeof patched.rulesVersion === "string" && patched.rulesVersion.trim()
      ? `${patched.rulesVersion.trim()}+matcher-v1`
      : "matcher-v1";

  if (
    typeof patched.recommendedNextStep !== "string" ||
    !patched.recommendedNextStep.trim() ||
    outcome !== "eligible"
  ) {
    patched.recommendedNextStep =
      outcome === "ineligible"
        ? "Applicant is below one or more mandatory requirements. Route to admissions review for final decision."
        : outcome === "insufficient_data"
          ? "Provide clearer transcript evidence (completion status, WAM/GPA, English-medium completion) and route for manual review."
          : "Proceed with application submission and admissions verification.";
  }

  return patched;
}

/**
 * Decides whether to use the new RequirementInstance matcher (when the client supplied requirements
 * derived from the canonical catalog) or the legacy deterministic regex rules.
 */
export function applyEligibilityResolution(
  assessment: Record<string, unknown>,
  context: TranscriptEligibilityRequestContext,
): Record<string, unknown> {
  if (context.requirements && context.requirements.length > 0) {
    return applyRequirementsMatcher(assessment, context);
  }
  return applyDeterministicEligibilityRules(assessment, context) as Record<string, unknown>;
}

export function withContextDefaults(
  assessment: Record<string, unknown>,
  context: TranscriptEligibilityRequestContext,
) {
  const patched = { ...assessment };

  if (typeof patched.checkedAt !== "string" || !patched.checkedAt.trim()) {
    patched.checkedAt = new Date().toISOString();
  }

  if (!patched.programCode && context.courseCode) {
    patched.programCode = context.courseCode;
  }

  if (!patched.programTitle && context.courseTitle) {
    patched.programTitle = context.courseTitle;
  }

  if (!patched.serviceVersion) {
    patched.serviceVersion = "local-openai-fallback";
  }

  return applyEligibilityResolution(patched, context);
}
