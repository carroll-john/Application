import {
  buildRecommendedNextStep,
  missingInformationCopyByReasonCode,
} from "./checkCopy.js";
import { applyDeterministicEligibilityRules } from "./deterministicRules.js";
import { aggregateOutcome, evaluateRequirementsWithPathways } from "./matcher.js";
import {
  requirementEvidenceSource,
  type EvidenceSource,
  type RequirementInstance,
} from "./requirements.js";
import type {
  EligibilityExtractedField,
  EligibilityPendingEvidence,
  EligibilityRequirementCheck,
  RequirementReasonCode,
  TranscriptExtractedData,
} from "./types.js";
import { RULES_VERSION } from "./version.js";
import type { TranscriptEligibilityRequestContext } from "./types.js";

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
        reasonCode: "SERVICE_UNAVAILABLE",
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

/**
 * Which document proves the requirement behind a check. Folded alternative-group checks carry ids
 * like `${groupId}:satisfied`; resolve them through the group's members. Unknown provenance is
 * treated as transcript-scoped (conservative: it counts against the transcript verdict).
 */
function evidenceSourceForCheck(
  check: EligibilityRequirementCheck,
  requirements: readonly RequirementInstance[],
): EvidenceSource {
  const direct = requirements.find((requirement) => requirement.id === check.id);
  if (direct) {
    return requirementEvidenceSource[direct.kind];
  }

  const groupDelimiter = check.id.indexOf(":");
  if (groupDelimiter > 0) {
    const groupId = check.id.slice(0, groupDelimiter);
    const members = requirements.filter(
      (requirement) => requirement.alternativeGroupId === groupId,
    );
    const sources = new Set(members.map((member) => requirementEvidenceSource[member.kind]));
    if (sources.size === 1) {
      return [...sources][0];
    }
  }

  return "transcript";
}

/** The extracted fields each transcript-scoped requirement kind reads, for derived confidence. */
const FIELDS_USED_BY_KIND: Partial<
  Record<RequirementInstance["kind"], Array<[keyof TranscriptExtractedData, string]>>
> = {
  qualification_completed: [["studyDetails", "completionStatus"]],
  qualification_level: [["studyDetails", "highestEducationLevel"]],
  academic_threshold: [
    ["academicPerformance", "gradeAverageOrWam"],
    ["academicPerformance", "gpa"],
    ["academicPerformance", "gpaScale"],
  ],
  english_proficiency: [["applicantDetails", "countryOfInstitution"]],
  field_of_study: [["studyDetails", "programName"]],
};

/**
 * Extraction confidence over only the fields the evaluators actually consumed for this course's
 * requirements — the minimum, so the number is honest about the weakest field the verdict relies
 * on. Falls back to the LLM's overall confidence when no consumed field carries one.
 */
function deriveExtractionConfidence(
  evidence: TranscriptExtractedData,
  requirements: readonly RequirementInstance[],
  fallback: unknown,
): number | unknown {
  const confidences: number[] = [];
  const kinds = new Set(requirements.map((requirement) => requirement.kind));
  for (const kind of kinds) {
    for (const [group, fieldName] of FIELDS_USED_BY_KIND[kind] ?? []) {
      const groupValue = evidence[group] as
        | Record<string, EligibilityExtractedField | undefined>
        | undefined;
      const field = groupValue?.[fieldName];
      if (field && typeof field.confidence === "number" && Number.isFinite(field.confidence)) {
        confidences.push(field.confidence);
      }
    }
  }
  return confidences.length > 0 ? Math.min(...confidences) : fallback;
}

function applyRequirementsMatcher(
  assessment: Record<string, unknown>,
  context: TranscriptEligibilityRequestContext,
): Record<string, unknown> {
  const requirements = context.requirements ?? [];
  const evidence = extractEvidence(assessment);
  const evaluation = evaluateRequirementsWithPathways(
    requirements,
    evidence,
    context,
  );
  const checks: EligibilityRequirementCheck[] = evaluation.checks;
  const conditionalIds = new Set(
    requirements.filter((r) => r.weight === "conditional").map((r) => r.id),
  );

  // The transcript verdict is scoped to what a transcript can prove. Requirements whose proof
  // lives in another document (CV, English test evidence) are diverted to `pendingEvidence` when
  // unconfirmed instead of degrading the outcome — a great transcript should not read as "more
  // information required" because the program also wants a CV.
  const pendingEvidence: EligibilityPendingEvidence[] = [];
  const scopedChecks: EligibilityRequirementCheck[] = [];
  for (const check of checks) {
    const source = evidenceSourceForCheck(check, requirements);
    const groupDelimiter = check.id.indexOf(":");
    const foldedGroupId = groupDelimiter > 0 ? check.id.slice(0, groupDelimiter) : undefined;
    const foldedGroupMembers = foldedGroupId
      ? requirements.filter((requirement) => requirement.alternativeGroupId === foldedGroupId)
      : [];
    const foldedGroupNeedsNonTranscriptEvidence =
      foldedGroupMembers.length > 0 &&
      foldedGroupMembers.some(
        (member) => requirementEvidenceSource[member.kind] !== "transcript",
      );

    if (
      check.status === "unknown" &&
      (source !== "transcript" || foldedGroupNeedsNonTranscriptEvidence)
    ) {
      pendingEvidence.push({
        evidenceSource:
          source !== "transcript"
            ? source
            : (requirementEvidenceSource[
                foldedGroupMembers.find(
                  (member) => requirementEvidenceSource[member.kind] !== "transcript",
                )?.kind ?? "work_experience"
              ] ?? "cv"),
        kind:
          requirements.find((requirement) => requirement.id === check.id)?.kind ??
          foldedGroupMembers[0]?.kind ??
          "",
        ...(check.reasonCode ? { reasonCode: check.reasonCode } : {}),
        requirementId: foldedGroupId ?? check.id,
      });
    } else {
      scopedChecks.push(check);
    }
  }

  const { outcome, manualReviewRequired } = aggregateOutcome(scopedChecks, { conditionalIds });

  const patched: Record<string, unknown> = { ...assessment };
  patched.requirementsChecked = checks;
  patched.pathwayResults = evaluation.pathwayResults;
  if (evaluation.selectedPathwayId) {
    patched.selectedPathwayId = evaluation.selectedPathwayId;
  }
  patched.outcome = outcome;
  patched.manualReviewRequired = manualReviewRequired;
  patched.pendingEvidence = pendingEvidence;

  // LLM free-text observations never reach the applicant: keep them for admissions/analytics.
  const llmNotes = Array.isArray(patched.missingInformation)
    ? patched.missingInformation.filter((item): item is string => typeof item === "string")
    : [];
  const existingNotes = Array.isArray(patched.extractionNotes)
    ? patched.extractionNotes.filter((item): item is string => typeof item === "string")
    : [];
  patched.extractionNotes = Array.from(new Set([...existingNotes, ...llmNotes]));

  // Applicant-facing bullets derive purely from unknown transcript-scoped checks via reasonCode
  // copy, so a bullet can never contradict a check that passed.
  const unknownScoped = scopedChecks.filter((check) => check.status === "unknown");
  patched.missingInformation = Array.from(
    new Set(
      unknownScoped.map((check) =>
        check.reasonCode
          ? missingInformationCopyByReasonCode[check.reasonCode]?.(check.details) ??
            check.explanation
          : check.explanation,
      ),
    ),
  );

  patched.recommendedNextStep = buildRecommendedNextStep({
    outcome,
    pendingEvidence,
    unknownTranscriptReasonCodes: unknownScoped
      .map((check) => check.reasonCode)
      .filter((code): code is RequirementReasonCode => Boolean(code)),
  });

  // Replace the LLM's overall confidence with one derived from the fields the verdict actually
  // used, so the number can't contradict the displayed result.
  patched.confidence = deriveExtractionConfidence(evidence, requirements, patched.confidence);

  patched.rulesVersion =
    typeof patched.rulesVersion === "string" && patched.rulesVersion.trim()
      ? `${patched.rulesVersion.trim()}+${RULES_VERSION}`
      : RULES_VERSION;

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
  // Always stamp server time, discarding any upstream checkedAt. External services / LLMs invent
  // this field (observed: dates years in the past), and checkedAt drives latest-assessment
  // selection on the client, so a hallucinated old date makes a fresh scan lose to a stale one.
  const stamped = { ...assessment, checkedAt: new Date().toISOString() };
  if (context.requirements && context.requirements.length > 0) {
    return applyRequirementsMatcher(stamped, context);
  }
  return applyDeterministicEligibilityRules(stamped, context) as Record<string, unknown>;
}

export function withContextDefaults(
  assessment: Record<string, unknown>,
  context: TranscriptEligibilityRequestContext,
) {
  const patched = { ...assessment };

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
