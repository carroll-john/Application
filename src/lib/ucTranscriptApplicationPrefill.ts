import type {
  ApplicationData,
  TertiaryQualification,
} from "./applicationData";
import {
  countDraftedFields,
  isQualificationCoreEmpty,
  mapExtractedDataToQualification,
  mergeQualificationDraft,
  type TertiaryQualificationFieldDraft,
} from "./eligibility/mapToTertiaryQualification";
import type { TranscriptEligibilityAssessment } from "./eligibility/types";

function normalizeIdentity(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function identifiesSameValue(left: string, right: string) {
  const normalizedLeft = normalizeIdentity(left);
  const normalizedRight = normalizeIdentity(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  return (
    normalizedLeft === normalizedRight ||
    (normalizedLeft.length >= 8 && normalizedRight.includes(normalizedLeft)) ||
    (normalizedRight.length >= 8 && normalizedLeft.includes(normalizedRight))
  );
}

function matchesTranscriptQualification(
  qualification: TertiaryQualification,
  draft: TertiaryQualificationFieldDraft,
) {
  if (isQualificationCoreEmpty(qualification)) {
    return true;
  }

  if (identifiesSameValue(qualification.courseName, draft.courseName)) {
    return true;
  }

  return (
    identifiesSameValue(qualification.institution, draft.institution) &&
    identifiesSameValue(qualification.level, draft.level) &&
    (!qualification.courseName.trim() || !draft.courseName.trim())
  );
}

function createQualification(
  draft: TertiaryQualificationFieldDraft,
  assessment: TranscriptEligibilityAssessment,
  createId: () => string,
) {
  const emptyQualification: TertiaryQualification = {
    id: createId(),
    institution: "",
    country: "Australia",
    level: "",
    courseName: "",
    startMonth: "",
    startYear: "",
    completed: true,
    endMonth: "",
    endYear: "",
  };

  return {
    ...mergeQualificationDraft(emptyQualification, draft),
    transcriptEligibility: assessment,
  };
}

/**
 * Transfers extracted study data after the applicant explicitly starts an authenticated
 * application. Document attachment is handled separately through the shared document layer.
 */
export function applyUcTranscriptApplicationPrefill(
  application: ApplicationData,
  assessment: TranscriptEligibilityAssessment,
  createId: () => string = () => crypto.randomUUID(),
): ApplicationData {
  const fieldDraft = mapExtractedDataToQualification(assessment.extractedData);

  if (countDraftedFields(fieldDraft) === 0) {
    return application;
  }

  const matchingIndex = application.tertiaryQualifications.findIndex((qualification) =>
    matchesTranscriptQualification(qualification, fieldDraft),
  );

  if (matchingIndex < 0) {
    return {
      ...application,
      tertiaryQualifications: [
        ...application.tertiaryQualifications,
        createQualification(fieldDraft, assessment, createId),
      ],
    };
  }

  return {
    ...application,
    tertiaryQualifications: application.tertiaryQualifications.map(
      (qualification, index) =>
        index === matchingIndex
          ? {
              ...mergeQualificationDraft(qualification, fieldDraft),
              transcriptEligibility:
                qualification.transcriptEligibility ?? assessment,
            }
          : qualification,
    ),
  };
}
