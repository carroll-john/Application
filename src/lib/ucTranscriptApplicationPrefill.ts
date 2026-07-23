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
import { isBillShortenUcDemoName } from "./ucDemoFixture";

export interface UcTranscriptApplicationPrefillOptions {
  createId?: () => string;
  /** CV-derived qualification suggestions to replace when transcript evidence identifies one. */
  cvQualificationsToReplace?: readonly TertiaryQualification[];
}

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

function matchesCvQualification(
  qualification: TertiaryQualification,
  cvQualification: TertiaryQualification,
) {
  if (qualification.id === cvQualification.id) {
    return true;
  }

  return (
    identifiesSameValue(qualification.courseName, cvQualification.courseName) &&
    identifiesSameValue(qualification.institution, cvQualification.institution)
  );
}

function qualificationNameTokens(value: string) {
  return new Set(
    normalizeIdentity(value)
      .split(" ")
      .filter(
        (token) =>
          token &&
          ![
            "ba",
            "bachelor",
            "degree",
            "double",
            "llb",
            "of",
          ].includes(token),
      ),
  );
}

function isQualificationSubsumedByTranscript(
  qualification: TertiaryQualification,
  transcriptQualification: TertiaryQualification,
) {
  if (
    !identifiesSameValue(qualification.institution, transcriptQualification.institution) ||
    !identifiesSameValue(qualification.level, transcriptQualification.level)
  ) {
    return false;
  }

  const qualificationTokens = qualificationNameTokens(qualification.courseName);
  const transcriptTokens = qualificationNameTokens(transcriptQualification.courseName);
  if (
    qualificationTokens.size === 0 ||
    transcriptTokens.size <= qualificationTokens.size
  ) {
    return false;
  }

  return [...qualificationTokens].every((token) => transcriptTokens.has(token));
}

function isBillShortenDemoAssessment(assessment: TranscriptEligibilityAssessment) {
  const fullName = assessment.extractedData.applicantDetails?.fullName;
  return isBillShortenUcDemoName(
    fullName?.normalizedValue ?? fullName?.originalValue ?? "",
  );
}

function replaceCvQualificationsWithTranscriptQualification(
  qualifications: TertiaryQualification[],
  transcriptQualification: TertiaryQualification,
  cvQualifications: readonly TertiaryQualification[],
  removeSubsumedDemoQualifications: boolean,
) {
  return qualifications.filter(
    (qualification) =>
      qualification.id === transcriptQualification.id ||
      (!cvQualifications.some((cvQualification) =>
        matchesCvQualification(qualification, cvQualification),
      ) &&
        !(
          removeSubsumedDemoQualifications &&
          isQualificationSubsumedByTranscript(
            qualification,
            transcriptQualification,
          )
        )),
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
  options: UcTranscriptApplicationPrefillOptions = {},
): ApplicationData {
  const createId = options.createId ?? (() => crypto.randomUUID());
  const fieldDraft = mapExtractedDataToQualification(assessment.extractedData);
  const removeSubsumedDemoQualifications = isBillShortenDemoAssessment(assessment);

  if (countDraftedFields(fieldDraft) === 0) {
    return application;
  }

  const matchingIndex = application.tertiaryQualifications.findIndex((qualification) =>
    matchesTranscriptQualification(qualification, fieldDraft),
  );

  if (matchingIndex < 0) {
    const transcriptQualification = createQualification(fieldDraft, assessment, createId);
    return {
      ...application,
      tertiaryQualifications: replaceCvQualificationsWithTranscriptQualification(
        [...application.tertiaryQualifications, transcriptQualification],
        transcriptQualification,
        options.cvQualificationsToReplace ?? [],
        removeSubsumedDemoQualifications,
      ),
    };
  }

  const transcriptQualification = {
    ...mergeQualificationDraft(
      application.tertiaryQualifications[matchingIndex],
      fieldDraft,
    ),
    transcriptEligibility:
      application.tertiaryQualifications[matchingIndex].transcriptEligibility ??
      assessment,
  };

  return {
    ...application,
    tertiaryQualifications: replaceCvQualificationsWithTranscriptQualification(
      application.tertiaryQualifications.map((qualification, index) =>
        index === matchingIndex ? transcriptQualification : qualification,
      ),
      transcriptQualification,
      options.cvQualificationsToReplace ?? [],
      removeSubsumedDemoQualifications,
    ),
  };
}
