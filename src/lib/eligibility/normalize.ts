import type {
  EligibilityExtractedField,
  EligibilityOutcome,
  EligibilityRequirementCheck,
  EligibilityRequirementStatus,
  TranscriptEligibilityAssessment,
} from "./types";

function normalizeConfidence(value: unknown, fallback = 0.5) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
}

function normalizeOutcome(value: unknown): EligibilityOutcome {
  if (
    value === "eligible" ||
    value === "conditionally_eligible" ||
    value === "ineligible" ||
    value === "insufficient_data"
  ) {
    return value;
  }

  return "insufficient_data";
}

function normalizeRequirementStatus(value: unknown): EligibilityRequirementStatus {
  if (value === "pass" || value === "fail" || value === "unknown") {
    return value;
  }

  return "unknown";
}

function normalizeExtractedField(value: unknown): EligibilityExtractedField | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;

  const normalized: EligibilityExtractedField = {
    confidence: normalizeConfidence(candidate.confidence, 0.5),
  };

  if (typeof candidate.originalValue === "string" && candidate.originalValue.trim()) {
    normalized.originalValue = candidate.originalValue.trim();
  }

  if (
    typeof candidate.normalizedValue === "string" &&
    candidate.normalizedValue.trim()
  ) {
    normalized.normalizedValue = candidate.normalizedValue.trim();
  }

  if (typeof candidate.missingOrAmbiguous === "boolean") {
    normalized.missingOrAmbiguous = candidate.missingOrAmbiguous;
  }

  if (
    !normalized.originalValue &&
    !normalized.normalizedValue &&
    normalized.missingOrAmbiguous === undefined
  ) {
    return undefined;
  }

  return normalized;
}

function normalizeExtractedGroup(value: unknown) {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;
  const entries = Object.entries(candidate)
    .map(([key, field]) => [key, normalizeExtractedField(field)] as const)
    .filter((entry): entry is readonly [string, EligibilityExtractedField] =>
      Boolean(entry[1]),
    );

  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries);
}

function normalizeRequirementChecks(value: unknown): EligibilityRequirementCheck[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry, index): EligibilityRequirementCheck | null => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const candidate = entry as Record<string, unknown>;
      const requirement =
        typeof candidate.requirement === "string" && candidate.requirement.trim()
          ? candidate.requirement.trim()
          : `Requirement ${index + 1}`;

      return {
        explanation:
          typeof candidate.explanation === "string" && candidate.explanation.trim()
            ? candidate.explanation.trim()
            : "No explanation was provided for this requirement.",
        id:
          typeof candidate.id === "string" && candidate.id.trim()
            ? candidate.id.trim()
            : `requirement-${index + 1}`,
        requirement,
        status: normalizeRequirementStatus(candidate.status),
      };
    })
    .filter((entry): entry is EligibilityRequirementCheck => Boolean(entry));
}

export function normalizeTranscriptEligibilityAssessment(
  payload: unknown,
): TranscriptEligibilityAssessment {
  const candidate =
    payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};

  const missingInformation = Array.isArray(candidate.missingInformation)
    ? candidate.missingInformation.filter(
        (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
      )
    : [];

  const recommendedNextStep =
    typeof candidate.recommendedNextStep === "string" &&
    candidate.recommendedNextStep.trim()
      ? candidate.recommendedNextStep.trim()
      : "Provide additional transcript evidence and request manual review.";

  return {
    checkedAt:
      typeof candidate.checkedAt === "string" && candidate.checkedAt.trim()
        ? candidate.checkedAt
        : new Date().toISOString(),
    confidence: normalizeConfidence(candidate.confidence, 0.45),
    extractedData: {
      academicPerformance: normalizeExtractedGroup(candidate.academicPerformance),
      applicantDetails: normalizeExtractedGroup(candidate.applicantDetails),
      englishLanguageEvidence: normalizeExtractedGroup(candidate.englishLanguageEvidence),
      studyDetails: normalizeExtractedGroup(candidate.studyDetails),
    },
    manualReviewRequired:
      typeof candidate.manualReviewRequired === "boolean"
        ? candidate.manualReviewRequired
        : true,
    missingInformation,
    outcome: normalizeOutcome(candidate.outcome),
    programCode:
      typeof candidate.programCode === "string" && candidate.programCode.trim()
        ? candidate.programCode.trim()
        : undefined,
    programTitle:
      typeof candidate.programTitle === "string" && candidate.programTitle.trim()
        ? candidate.programTitle.trim()
        : undefined,
    recommendedNextStep,
    requirementsChecked: normalizeRequirementChecks(candidate.requirementsChecked),
    rulesVersion:
      typeof candidate.rulesVersion === "string" && candidate.rulesVersion.trim()
        ? candidate.rulesVersion.trim()
        : undefined,
    serviceVersion:
      typeof candidate.serviceVersion === "string" && candidate.serviceVersion.trim()
        ? candidate.serviceVersion.trim()
        : undefined,
  };
}

