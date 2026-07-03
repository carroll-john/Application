import type {
  EligibilityCheckDetails,
  EligibilityExtractedField,
  EligibilityOutcome,
  EligibilityPendingEvidence,
  EligibilityRequirementCheck,
  EligibilityRequirementStatus,
  RequirementReasonCode,
  TranscriptEligibilityAssessment,
} from "./types";
import { ALL_REQUIREMENT_REASON_CODES } from "./types";

const KNOWN_REASON_CODES = new Set<string>(ALL_REQUIREMENT_REASON_CODES);

function normalizeReasonCode(value: unknown): RequirementReasonCode | undefined {
  return typeof value === "string" && KNOWN_REASON_CODES.has(value)
    ? (value as RequirementReasonCode)
    : undefined;
}

function normalizeCheckDetails(value: unknown): EligibilityCheckDetails | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const candidate = value as Record<string, unknown>;
  const details: EligibilityCheckDetails = {};
  for (const key of ["metric", "observed", "required"] as const) {
    const entry = candidate[key];
    if (typeof entry === "string" && entry.trim()) {
      details[key] = entry.trim();
    }
  }
  return Object.keys(details).length > 0 ? details : undefined;
}

const EVIDENCE_SOURCES = new Set(["transcript", "cv", "english_evidence"]);

function normalizePendingEvidence(value: unknown): EligibilityPendingEvidence[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const out = value
    .map((entry): EligibilityPendingEvidence | null => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const candidate = entry as Record<string, unknown>;
      if (
        typeof candidate.requirementId !== "string" ||
        !candidate.requirementId.trim() ||
        typeof candidate.evidenceSource !== "string" ||
        !EVIDENCE_SOURCES.has(candidate.evidenceSource)
      ) {
        return null;
      }
      return {
        evidenceSource: candidate.evidenceSource as EligibilityPendingEvidence["evidenceSource"],
        kind: typeof candidate.kind === "string" ? candidate.kind : "",
        reasonCode: normalizeReasonCode(candidate.reasonCode),
        requirementId: candidate.requirementId.trim(),
      };
    })
    .filter((entry): entry is EligibilityPendingEvidence => Boolean(entry));
  return out.length > 0 ? out : undefined;
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const out = value.filter(
    (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
  );
  return out.length > 0 ? out : undefined;
}

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

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

      const details = normalizeCheckDetails(candidate.details);
      const reasonCode = normalizeReasonCode(candidate.reasonCode);

      return {
        ...(details ? { details } : {}),
        explanation:
          typeof candidate.explanation === "string" && candidate.explanation.trim()
            ? candidate.explanation.trim()
            : "No explanation was provided for this requirement.",
        id:
          typeof candidate.id === "string" && candidate.id.trim()
            ? candidate.id.trim()
            : `requirement-${index + 1}`,
        ...(reasonCode ? { reasonCode } : {}),
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
  const evidenceSource =
    candidate.extractedData &&
    typeof candidate.extractedData === "object" &&
    !Array.isArray(candidate.extractedData)
      ? (candidate.extractedData as Record<string, unknown>)
      : candidate;

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
      academicPerformance: normalizeExtractedGroup(evidenceSource.academicPerformance),
      applicantDetails: normalizeExtractedGroup(evidenceSource.applicantDetails),
      englishLanguageEvidence: normalizeExtractedGroup(evidenceSource.englishLanguageEvidence),
      studyDetails: normalizeExtractedGroup(evidenceSource.studyDetails),
    },
    extractionNotes: normalizeStringArray(candidate.extractionNotes),
    manualReviewRequired:
      typeof candidate.manualReviewRequired === "boolean"
        ? candidate.manualReviewRequired
        : true,
    missingInformation,
    modelId: normalizeOptionalString(candidate.modelId),
    outcome: normalizeOutcome(candidate.outcome),
    pendingEvidence: normalizePendingEvidence(candidate.pendingEvidence),
    programCode:
      typeof candidate.programCode === "string" && candidate.programCode.trim()
        ? candidate.programCode.trim()
        : undefined,
    programTitle:
      typeof candidate.programTitle === "string" && candidate.programTitle.trim()
        ? candidate.programTitle.trim()
        : undefined,
    promptVersion: normalizeOptionalString(candidate.promptVersion),
    recommendedNextStep,
    requirementsChecked: normalizeRequirementChecks(candidate.requirementsChecked),
    rulesVersion:
      typeof candidate.rulesVersion === "string" && candidate.rulesVersion.trim()
        ? candidate.rulesVersion.trim()
        : undefined,
    schemaVersion: normalizeOptionalString(candidate.schemaVersion),
    serviceVersion:
      typeof candidate.serviceVersion === "string" && candidate.serviceVersion.trim()
        ? candidate.serviceVersion.trim()
        : undefined,
  };
}

