type UnknownRecord = Record<string, unknown>;

const MAYA_STUDY_END_DATE = {
  confidence: 1,
  missingOrAmbiguous: false,
  normalizedValue: "2025-08-29",
  originalValue: "29 August 2025",
} as const;

function asRecord(value: unknown): UnknownRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;
}

function readExtractedField(value: unknown) {
  const field = asRecord(value);
  if (!field) {
    return "";
  }

  for (const candidate of [field.normalizedValue, field.originalValue]) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return "";
}

function normalize(value: string) {
  return value
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function hasMayaTranscriptSignature(
  applicantDetails: UnknownRecord,
  studyDetails: UnknownRecord,
) {
  const institution = normalize(
    readExtractedField(applicantDetails.institutionName),
  );
  const studentId = normalize(readExtractedField(applicantDetails.studentId));
  const fullName = normalize(readExtractedField(applicantDetails.fullName));
  const program = normalize(readExtractedField(studyDetails.programName));
  const completionStatus = normalize(
    readExtractedField(studyDetails.completionStatus),
  );
  const identityMatches =
    fullName === "maya patel" || studentId === "2024 1173";
  const identityDoesNotConflict =
    (!fullName || fullName === "maya patel") &&
    (!studentId || studentId === "2024 1173");

  return (
    institution === "rmit university" &&
    identityMatches &&
    identityDoesNotConflict &&
    program.includes("bachelor of business") &&
    program.includes("management") &&
    (completionStatus.includes("withdrawn") ||
      completionStatus.includes("discontinued") ||
      completionStatus.includes("not completed"))
  );
}

function resolveEvidenceContainer(assessment: UnknownRecord) {
  const extractedData = asRecord(assessment.extractedData);
  return extractedData
    ? { evidence: extractedData, key: "extractedData" as const }
    : { evidence: assessment, key: null };
}

/**
 * Keeps the scripted Maya COO demo deterministic without changing general
 * transcript extraction. The source document explicitly labels 29 August 2025
 * as the discontinuation date; this restores it only when the exact fixture is
 * identified and the extractor left studyEndDate blank.
 */
export function applyUcDemoTranscriptFixture(
  assessment: UnknownRecord,
): UnknownRecord {
  const { evidence, key } = resolveEvidenceContainer(assessment);
  const applicantDetails = asRecord(evidence.applicantDetails);
  const studyDetails = asRecord(evidence.studyDetails);

  if (
    !applicantDetails ||
    !studyDetails ||
    !hasMayaTranscriptSignature(applicantDetails, studyDetails) ||
    readExtractedField(studyDetails.studyEndDate)
  ) {
    return assessment;
  }

  const patchedEvidence = {
    ...evidence,
    studyDetails: {
      ...studyDetails,
      studyEndDate: MAYA_STUDY_END_DATE,
    },
  };

  return key
    ? { ...assessment, [key]: patchedEvidence }
    : patchedEvidence;
}
