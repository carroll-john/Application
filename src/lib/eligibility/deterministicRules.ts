import { classifyQualificationRank } from "./aqfLevels.js";
import { commonTertiaryInstitutionSuggestions } from "../tertiaryInstitutions.js";
import {
  buildRecommendedNextStep,
  missingInformationCopyByReasonCode,
} from "./checkCopy.js";
import {
  calculateWamFromUnitResults,
  resolveComparableWam,
  type AcademicUnitResultInput,
} from "./academicResults.js";
import type {
  EligibilityRequirementCheck,
  EligibilityRequirementStatus,
  RequirementReasonCode,
  TranscriptEligibilityRequestContext,
} from "./types";

const AU_UNIVERSITIES = new Set(
  commonTertiaryInstitutionSuggestions.map((item) => item.value.trim().toLowerCase()),
);

type LooseRecord = Record<string, unknown>;

function asRecord(value: unknown): LooseRecord | undefined {
  return value && typeof value === "object" ? (value as LooseRecord) : undefined;
}

function readFieldValue(group: LooseRecord | undefined, key: string): string | undefined {
  const field = asRecord(group?.[key]);
  const raw =
    (typeof field?.normalizedValue === "string" ? field.normalizedValue : undefined) ??
    (typeof field?.originalValue === "string" ? field.originalValue : undefined);
  return raw?.trim() || undefined;
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const match = value.match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    return undefined;
  }

  const parsed = Number.parseFloat(match[0]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toPercentFromGpa(gpa: number, scale: number): number | undefined {
  if (scale <= 0) {
    return undefined;
  }

  return (gpa / scale) * 100;
}

function upsertExtractedField(target: LooseRecord, key: string, value: LooseRecord) {
  target[key] = {
    confidence: typeof value.confidence === "number" ? value.confidence : 0.6,
    missingOrAmbiguous:
      typeof value.missingOrAmbiguous === "boolean" ? value.missingOrAmbiguous : true,
    normalizedValue:
      typeof value.normalizedValue === "string" ? value.normalizedValue : undefined,
    originalValue: typeof value.originalValue === "string" ? value.originalValue : undefined,
  };
}

function ensureGroup(container: LooseRecord, key: string): LooseRecord {
  const existing = asRecord(container[key]);
  if (existing) {
    return existing;
  }
  const created: LooseRecord = {};
  container[key] = created;
  return created;
}

function evaluateAuEnglishProficiency(
  assessment: LooseRecord,
  context: TranscriptEligibilityRequestContext,
): boolean {
  const applicantDetails = ensureGroup(assessment, "applicantDetails");
  const englishEvidence = ensureGroup(assessment, "englishLanguageEvidence");
  const institution =
    readFieldValue(applicantDetails, "institutionName") ?? context.institution?.trim();
  const country =
    readFieldValue(applicantDetails, "countryOfInstitution") ?? context.country?.trim();

  if (!institution || !country) {
    return false;
  }

  const isAustralianInstitution = AU_UNIVERSITIES.has(institution.toLowerCase());
  const countryIsAustralia = country.toLowerCase() === "australia";
  if (!isAustralianInstitution || !countryIsAustralia) {
    return false;
  }

  if (!readFieldValue(englishEvidence, "englishInstructionEvidence")) {
    upsertExtractedField(englishEvidence, "englishInstructionEvidence", {
      confidence: 0.95,
      missingOrAmbiguous: false,
      normalizedValue: "english_instruction_au_institution",
      originalValue:
        "Completion of program at a recognised Australian tertiary institution.",
    });
  }

  if (!readFieldValue(englishEvidence, "englishRequirementSatisfaction")) {
    upsertExtractedField(englishEvidence, "englishRequirementSatisfaction", {
      confidence: 0.95,
      missingOrAmbiguous: false,
      normalizedValue: "satisfied_by_au_completion",
      originalValue:
        "English proficiency satisfied by completion at a recognised Australian tertiary institution.",
    });
  }

  return true;
}

type DeterministicOutcome =
  | "eligible"
  | "conditionally_eligible"
  | "ineligible"
  | "insufficient_data";

/** Structured checks the upstream service supplied in its own payload, defensively extracted. */
function readUpstreamChecks(assessment: Record<string, unknown>) {
  if (!Array.isArray(assessment.requirementsChecked)) {
    return [];
  }
  return assessment.requirementsChecked.filter(
    (entry): entry is { status: string } =>
      Boolean(entry) &&
      typeof entry === "object" &&
      typeof (entry as Record<string, unknown>).status === "string",
  );
}

/**
 * Reconciles the upstream service's holistic verdict with the structured checks. The deterministic
 * rules only cover generic requirements (completion, level, WAM/GPA, English), so for multi-pathway
 * fallback courses the service's outcome carries signal the rules cannot compute and is preserved —
 * but only while it doesn't contradict the checks:
 *
 *   - any failed check (upstream or deterministic) is definitive → ineligible
 *   - an unknown deterministic check means the transcript left a generic rule unresolved →
 *     insufficient_data
 *   - "insufficient_data" alongside all-passing checks is a contradiction (nothing is missing per
 *     the structured evidence; LLM verdicts have been observed inventing it) → eligible
 *   - otherwise the upstream verdict passes through; absent/invalid verdicts become eligible
 */
function resolveOutcome(
  deterministicChecks: EligibilityRequirementCheck[],
  upstreamChecks: ReadonlyArray<{ status: string }>,
  upstreamOutcome: unknown,
): DeterministicOutcome {
  const combined = [...upstreamChecks, ...deterministicChecks];
  if (combined.some((check) => check.status === "fail")) {
    return "ineligible";
  }
  if (deterministicChecks.some((check) => check.status === "unknown")) {
    return "insufficient_data";
  }
  if (
    upstreamOutcome === "eligible" ||
    upstreamOutcome === "conditionally_eligible" ||
    upstreamOutcome === "ineligible" ||
    upstreamOutcome === "insufficient_data"
  ) {
    if (
      upstreamOutcome === "insufficient_data" &&
      combined.every((check) => check.status === "pass")
    ) {
      return "eligible";
    }
    return upstreamOutcome;
  }
  return "eligible";
}

export function applyDeterministicEligibilityRules(
  assessmentPayload: unknown,
  context: TranscriptEligibilityRequestContext,
) {
  const assessment = asRecord(assessmentPayload) ?? {};
  const applicantDetails = ensureGroup(assessment, "applicantDetails");
  const studyDetails = ensureGroup(assessment, "studyDetails");
  const academicPerformance = ensureGroup(assessment, "academicPerformance");

  const checks: EligibilityRequirementCheck[] = [];

  // The LLM's free-text observations are kept for admissions/analytics only. Applicant-facing
  // missing-information bullets are derived from the deterministic checks below, so they can never
  // contradict a check that passed.
  const llmNotes = Array.isArray(assessment.missingInformation)
    ? assessment.missingInformation.filter((item): item is string => typeof item === "string")
    : [];
  if (llmNotes.length > 0) {
    const existingNotes = Array.isArray(assessment.extractionNotes)
      ? assessment.extractionNotes.filter((item): item is string => typeof item === "string")
      : [];
    assessment.extractionNotes = Array.from(new Set([...existingNotes, ...llmNotes]));
  }

  const completionFromTranscript = readFieldValue(studyDetails, "completionStatus")
    ?.toLowerCase()
    .replace(/_/g, " ");
  const completionFromForm = context.completed;
  const completionIndicatesNotCompleted =
    completionFromTranscript?.includes("in progress") ||
    completionFromTranscript?.includes("not completed") ||
    completionFromTranscript?.includes("withdrawn");
  const completionIndicatesCompleted =
    completionFromTranscript?.includes("completed") ||
    completionFromTranscript?.includes("conferred");
  const isCompleted = completionIndicatesNotCompleted
    ? false
    : completionIndicatesCompleted
      ? true
      : completionFromForm;

  const completionStatus: EligibilityRequirementStatus =
    completionIndicatesNotCompleted || completionFromForm === false
      ? "fail"
      : isCompleted
        ? "pass"
        : "unknown";

  checks.push({
    id: "deterministic-completion",
    requirement: "Completed qualification requirement",
    status: completionStatus,
    reasonCode:
      completionStatus === "pass"
        ? "QUALIFICATION_COMPLETE"
        : completionStatus === "fail"
          ? "QUALIFICATION_INCOMPLETE"
          : "QUALIFICATION_COMPLETION_UNKNOWN",
    explanation:
      completionStatus === "pass"
        ? "Qualification appears completed based on supplied evidence."
        : completionStatus === "fail"
          ? "Qualification appears incomplete or withdrawn based on supplied evidence."
          : "Completion status is unclear or not confirmed in transcript evidence.",
  });

  const requiredLevel = context.qualificationLevelRequirement?.trim();
  if (requiredLevel) {
    const extractedLevel =
      readFieldValue(studyDetails, "highestEducationLevel") ?? context.level?.trim();
    const extractedRank = classifyQualificationRank(extractedLevel);
    const requiredRank = classifyQualificationRank(requiredLevel);
    let status: EligibilityRequirementStatus = "unknown";
    if (requiredRank !== undefined && extractedRank !== undefined) {
      status = extractedRank >= requiredRank ? "pass" : "fail";
    }

    checks.push({
      id: "deterministic-qualification-level",
      requirement: `Minimum qualification level (${requiredLevel})`,
      status,
      reasonCode:
        status === "pass"
          ? "QUALIFICATION_LEVEL_MET"
          : status === "fail"
            ? "QUALIFICATION_LEVEL_BELOW"
            : "QUALIFICATION_LEVEL_UNKNOWN",
      ...(extractedLevel ? { details: { observed: extractedLevel, required: requiredLevel } } : {}),
      explanation:
        status === "pass"
          ? `Extracted level "${extractedLevel}" satisfies the required qualification level.`
          : status === "fail"
            ? `Extracted level "${extractedLevel}" is below the required level "${requiredLevel}".`
            : "Qualification level mapping is ambiguous and needs manual verification.",
    });
  }

  const minWam = context.minWam;
  const minGpaValue = context.minGpaValue;
  const minGpaScale = context.minGpaScale;
  const wamValue = parseNumber(readFieldValue(academicPerformance, "gradeAverageOrWam"));
  const calculatedWam = calculateWamFromUnitResults(
    Array.isArray(academicPerformance.unitResults)
      ? (academicPerformance.unitResults as AcademicUnitResultInput[])
      : undefined,
  );
  const gpaValue = parseNumber(readFieldValue(academicPerformance, "gpa"));
  const gpaScale = parseNumber(readFieldValue(academicPerformance, "gpaScale"));

  if (typeof minWam === "number" || typeof minGpaValue === "number") {
    let thresholdStatus: EligibilityRequirementStatus = "unknown";
    let thresholdExplanation = "Academic threshold evidence is incomplete.";
    let thresholdExplanationLead = "";
    let thresholdReasonCode: RequirementReasonCode = "ACADEMIC_EVIDENCE_MISSING";
    let thresholdDetails: EligibilityRequirementCheck["details"];

    if (typeof minWam === "number") {
      const resolvedWam = resolveComparableWam({
        calculatedWam,
        extractedWam: wamValue,
        gpaScale,
        gpaValue,
        mapGpaToPercent: toPercentFromGpa,
      });

      if (resolvedWam) {
        const { explanationLead, wam: comparableWam } = resolvedWam;
        thresholdStatus = comparableWam >= minWam ? "pass" : "fail";
        thresholdReasonCode = thresholdStatus === "pass" ? "WAM_MET" : "WAM_BELOW";
        thresholdDetails = {
          metric: "wam",
          observed: comparableWam.toFixed(1),
          required: String(minWam),
        };
        thresholdExplanationLead = explanationLead;
        thresholdExplanation =
          thresholdStatus === "pass"
            ? `${thresholdExplanationLead}Comparable WAM ${comparableWam.toFixed(1)} meets minimum WAM ${minWam}.`
            : `${thresholdExplanationLead}Comparable WAM ${comparableWam.toFixed(1)} is below minimum WAM ${minWam}.`;
      }
    } else if (typeof minGpaValue === "number") {
      let comparableGpa: number | undefined =
        gpaValue !== undefined ? gpaValue : undefined;
      let comparableScale: number | undefined =
        gpaScale !== undefined ? gpaScale : minGpaScale;
      const wamForGpaConversion = resolveComparableWam({
        calculatedWam,
        extractedWam: wamValue,
        gpaScale,
        gpaValue,
        mapGpaToPercent: toPercentFromGpa,
      })?.wam;

      if (
        comparableGpa === undefined &&
        wamForGpaConversion !== undefined &&
        typeof minGpaScale === "number"
      ) {
        comparableScale = minGpaScale;
        comparableGpa = (wamForGpaConversion / 100) * minGpaScale;
        thresholdExplanationLead = `Mapped WAM ${wamForGpaConversion.toFixed(
          1,
        )}% to approximately GPA ${comparableGpa.toFixed(2)}/${minGpaScale}. `;
      }

      if (
        comparableGpa !== undefined &&
        comparableScale !== undefined &&
        comparableScale > 0
      ) {
        const normalizedGpa = comparableGpa / comparableScale;
        const requiredScale = minGpaScale ?? comparableScale;
        const requiredNormalized = minGpaValue / requiredScale;
        thresholdStatus = normalizedGpa >= requiredNormalized ? "pass" : "fail";
        thresholdReasonCode = thresholdStatus === "pass" ? "GPA_MET" : "GPA_BELOW";
        thresholdDetails = {
          metric: "gpa",
          observed: `${comparableGpa.toFixed(2)}/${comparableScale}`,
          required: `${minGpaValue}/${requiredScale}`,
        };
        thresholdExplanation =
          thresholdStatus === "pass"
            ? `${thresholdExplanationLead}Comparable GPA ${comparableGpa.toFixed(2)}/${comparableScale} meets minimum GPA ${minGpaValue}/${requiredScale}.`
            : `${thresholdExplanationLead}Comparable GPA ${comparableGpa.toFixed(2)}/${comparableScale} is below minimum GPA ${minGpaValue}/${requiredScale}.`;
      }
    }

    checks.push({
      id: "deterministic-wam-gpa-threshold",
      requirement:
        typeof minWam === "number"
          ? `Minimum WAM threshold (${minWam})`
          : `Minimum GPA threshold (${minGpaValue}/${minGpaScale ?? "unknown scale"})`,
      status: thresholdStatus,
      reasonCode: thresholdReasonCode,
      ...(thresholdDetails ? { details: thresholdDetails } : {}),
      explanation: thresholdExplanation,
    });
  }

  const englishProficiencySatisfied = evaluateAuEnglishProficiency(assessment, context);
  if (englishProficiencySatisfied) {
    checks.push({
      id: "deterministic-english-proficiency",
      requirement: "English language proficiency",
      status: "pass",
      reasonCode: "ENGLISH_OK_COUNTRY",
      details: { observed: "Australia" },
      explanation:
        "English language proficiency satisfied by completion at a recognised Australian tertiary institution.",
    });
  }

  const deterministicChecks = checks.filter((item) => item.id.startsWith("deterministic-"));
  const upstreamChecks = readUpstreamChecks(assessment);
  const outcome = resolveOutcome(deterministicChecks, upstreamChecks, assessment.outcome);
  const needsManualReview = deterministicChecks.some((item) => item.status === "unknown");
  // When the upstream "insufficient_data" verdict was overridden as contradictory, its
  // manualReviewRequired flag is part of the same invented verdict and is discarded with it.
  const upstreamVerdictOverridden =
    assessment.outcome === "insufficient_data" && outcome === "eligible";

  // Applicant-facing bullets derive purely from unknown checks (reasonCode copy), so they can
  // never mention a requirement that passed.
  const unknownReasonCodes = deterministicChecks
    .filter((check) => check.status === "unknown")
    .map((check) => check.reasonCode)
    .filter((code): code is RequirementReasonCode => Boolean(code));
  const missingInformation = deterministicChecks
    .filter((check) => check.status === "unknown")
    .map((check) =>
      check.reasonCode
        ? missingInformationCopyByReasonCode[check.reasonCode]?.(check.details) ??
          check.explanation
        : check.explanation,
    );

  assessment.requirementsChecked = checks;
  assessment.outcome = outcome;
  assessment.manualReviewRequired =
    needsManualReview ||
    (!upstreamVerdictOverridden && Boolean(assessment.manualReviewRequired));
  assessment.missingInformation = Array.from(new Set(missingInformation));
  assessment.rulesVersion =
    typeof assessment.rulesVersion === "string" && assessment.rulesVersion.trim()
      ? `${assessment.rulesVersion.trim()}+deterministic-v1`
      : "deterministic-v1";

  assessment.recommendedNextStep = buildRecommendedNextStep({
    outcome,
    unknownTranscriptReasonCodes: unknownReasonCodes,
  });

  if (!readFieldValue(applicantDetails, "institutionName") && context.institution?.trim()) {
    upsertExtractedField(applicantDetails, "institutionName", {
      confidence: 0.8,
      missingOrAmbiguous: false,
      normalizedValue: context.institution.trim(),
      originalValue: context.institution.trim(),
    });
  }

  return assessment;
}
