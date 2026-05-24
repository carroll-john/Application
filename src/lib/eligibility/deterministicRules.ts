import { commonTertiaryInstitutionSuggestions } from "../tertiaryInstitutions.js";
import type {
  EligibilityRequirementCheck,
  EligibilityRequirementStatus,
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

function classifyQualification(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const text = value.toLowerCase();
  if (text.includes("doctor")) {
    return 5;
  }
  if (text.includes("master")) {
    return 4;
  }
  if (text.includes("bachelor")) {
    return 3;
  }
  if (text.includes("diploma")) {
    return 2;
  }
  if (text.includes("secondary") || text.includes("high school")) {
    return 1;
  }
  return undefined;
}

function updateOutcomeFromChecks(
  requiredChecks: EligibilityRequirementCheck[],
  currentOutcome: unknown,
) {
  if (requiredChecks.some((check) => check.status === "fail")) {
    return "ineligible" as const;
  }
  if (requiredChecks.some((check) => check.status === "unknown")) {
    return "insufficient_data" as const;
  }
  if (
    currentOutcome === "eligible" ||
    currentOutcome === "conditionally_eligible" ||
    currentOutcome === "ineligible" ||
    currentOutcome === "insufficient_data"
  ) {
    return currentOutcome;
  }
  return "eligible" as const;
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
  const missingInformation = Array.isArray(assessment.missingInformation)
    ? assessment.missingInformation.filter((item): item is string => typeof item === "string")
    : [];

  const completionFromTranscript = readFieldValue(studyDetails, "completionStatus")?.toLowerCase();
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
    explanation:
      completionStatus === "pass"
        ? "Qualification appears completed based on supplied evidence."
        : completionStatus === "fail"
          ? "Qualification appears incomplete or withdrawn based on supplied evidence."
          : "Completion status is unclear or not confirmed in transcript evidence.",
  });
  if (completionStatus === "unknown") {
    missingInformation.push(
      "Completion status could not be confidently established from transcript evidence.",
    );
  }

  const requiredLevel = context.qualificationLevelRequirement?.trim();
  if (requiredLevel) {
    const extractedLevel =
      readFieldValue(studyDetails, "highestEducationLevel") ?? context.level?.trim();
    const extractedRank = classifyQualification(extractedLevel);
    const requiredRank = classifyQualification(requiredLevel);
    let status: EligibilityRequirementStatus = "unknown";
    if (requiredRank !== undefined && extractedRank !== undefined) {
      status = extractedRank >= requiredRank ? "pass" : "fail";
    }

    checks.push({
      id: "deterministic-qualification-level",
      requirement: `Minimum qualification level (${requiredLevel})`,
      status,
      explanation:
        status === "pass"
          ? `Extracted level "${extractedLevel}" satisfies the required qualification level.`
          : status === "fail"
            ? `Extracted level "${extractedLevel}" is below the required level "${requiredLevel}".`
            : "Qualification level mapping is ambiguous and needs manual verification.",
    });

    if (status === "unknown") {
      missingInformation.push(
        "Qualification level could not be mapped confidently to the program requirement.",
      );
    }
  }

  const minWam = context.minWam;
  const minGpaValue = context.minGpaValue;
  const minGpaScale = context.minGpaScale;
  const wamValue = parseNumber(readFieldValue(academicPerformance, "gradeAverageOrWam"));
  const gpaValue = parseNumber(readFieldValue(academicPerformance, "gpa"));
  const gpaScale = parseNumber(readFieldValue(academicPerformance, "gpaScale"));

  if (typeof minWam === "number" || typeof minGpaValue === "number") {
    let thresholdStatus: EligibilityRequirementStatus = "unknown";
    let thresholdExplanation = "Academic threshold evidence is incomplete.";

    if (typeof minWam === "number") {
      let comparableWam: number | undefined = wamValue;
      if (comparableWam === undefined && gpaValue !== undefined && gpaScale !== undefined) {
        comparableWam = toPercentFromGpa(gpaValue, gpaScale);
        thresholdExplanation = `Mapped GPA ${gpaValue}/${gpaScale} to approximately ${comparableWam?.toFixed(
          1,
        )}% WAM for threshold comparison.`;
      }

      if (comparableWam !== undefined) {
        thresholdStatus = comparableWam >= minWam ? "pass" : "fail";
        thresholdExplanation =
          thresholdStatus === "pass"
            ? `Comparable WAM ${comparableWam.toFixed(1)} meets minimum WAM ${minWam}.`
            : `Comparable WAM ${comparableWam.toFixed(1)} is below minimum WAM ${minWam}.`;
      }
    } else if (typeof minGpaValue === "number") {
      let comparableGpa: number | undefined =
        gpaValue !== undefined ? gpaValue : undefined;
      let comparableScale: number | undefined =
        gpaScale !== undefined ? gpaScale : minGpaScale;

      if (comparableGpa === undefined && wamValue !== undefined && typeof minGpaScale === "number") {
        comparableScale = minGpaScale;
        comparableGpa = (wamValue / 100) * minGpaScale;
        thresholdExplanation = `Mapped WAM ${wamValue.toFixed(
          1,
        )}% to approximately GPA ${comparableGpa.toFixed(2)}/${minGpaScale}.`;
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
        thresholdExplanation =
          thresholdStatus === "pass"
            ? `Comparable GPA ${comparableGpa.toFixed(2)}/${comparableScale} meets minimum GPA ${minGpaValue}/${requiredScale}.`
            : `Comparable GPA ${comparableGpa.toFixed(2)}/${comparableScale} is below minimum GPA ${minGpaValue}/${requiredScale}.`;
      }
    }

    checks.push({
      id: "deterministic-wam-gpa-threshold",
      requirement:
        typeof minWam === "number"
          ? `Minimum WAM threshold (${minWam})`
          : `Minimum GPA threshold (${minGpaValue}/${minGpaScale ?? "unknown scale"})`,
      status: thresholdStatus,
      explanation: thresholdExplanation,
    });

    if (thresholdStatus === "unknown") {
      missingInformation.push(
        "WAM/GPA evidence could not be mapped confidently to the program threshold.",
      );
    }
  }

  const englishProficiencySatisfied = evaluateAuEnglishProficiency(assessment, context);
  if (englishProficiencySatisfied) {
    checks.push({
      id: "deterministic-english-proficiency",
      requirement: "English language proficiency",
      status: "pass",
      explanation:
        "English language proficiency satisfied by completion at a recognised Australian tertiary institution.",
    });
  }

  const deterministicChecks = checks.filter((item) => item.id.startsWith("deterministic-"));
  let outcome = updateOutcomeFromChecks(deterministicChecks, assessment.outcome);
  const needsManualReview = deterministicChecks.some((item) => item.status === "unknown");

  if (outcome === "eligible" && needsManualReview) {
    outcome = "conditionally_eligible";
  }

  assessment.requirementsChecked = checks;
  assessment.outcome = outcome;
  assessment.manualReviewRequired =
    needsManualReview || Boolean(assessment.manualReviewRequired);
  assessment.missingInformation = Array.from(new Set(missingInformation));
  assessment.rulesVersion =
    typeof assessment.rulesVersion === "string" && assessment.rulesVersion.trim()
      ? `${assessment.rulesVersion.trim()}+deterministic-v1`
      : "deterministic-v1";

  if (
    typeof assessment.recommendedNextStep !== "string" ||
    !assessment.recommendedNextStep.trim() ||
    outcome !== "eligible"
  ) {
    assessment.recommendedNextStep =
      outcome === "ineligible"
        ? "Applicant is below one or more mandatory thresholds. Route to admissions review for final decision."
        : outcome === "insufficient_data"
          ? "Provide clearer transcript evidence (completion status and WAM/GPA details) and route for manual admissions review."
          : "Proceed with application submission and admissions verification.";
  }

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
