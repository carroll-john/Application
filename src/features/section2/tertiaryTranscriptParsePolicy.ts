import type { ApplicationData, TertiaryQualification } from "../../lib/applicationData";
import { getCourseByCode } from "../../lib/courseCatalog";
import { parseEntryRequirementThresholds } from "../../lib/courseCatalog/normalize";
import {
  evaluateTranscriptEligibility,
  TranscriptEligibilityRequestError,
} from "../../lib/eligibility/client";
import { createInsufficientDataAssessment } from "../../lib/eligibility/fallback";
import {
  countDraftedFields,
  countQualificationDraftUpdates,
  isQualificationCoreEmpty,
  mapExtractedDataToQualification,
  mergeQualificationDraft,
  mergeQualificationFromTranscriptParse,
  qualificationFieldDraftDiffers,
  type TertiaryQualificationFieldDraft,
} from "../../lib/eligibility/mapToTertiaryQualification";
import type {
  TranscriptEligibilityAssessment,
  TranscriptEligibilityRequestContext,
} from "../../lib/eligibility/types";
import type { UploadedDocument } from "../../lib/documentStorage";

export interface TertiaryTranscriptParseContext {
  applicationData: ApplicationData;
  formData: TertiaryQualification;
  selectedTranscriptFile: File | null;
}

export interface TertiaryTranscriptParseResult {
  assessment: TranscriptEligibilityAssessment;
  fieldDraft: TertiaryQualificationFieldDraft;
  mergedRecord: TertiaryQualification;
  replacedExistingFields: boolean;
  shouldAutoFill: boolean;
}

export const tertiaryTranscriptParseCopy = {
  draftSuccess:
    "We drafted a qualification from your transcript. Review the details below, then save when ready.",
  draftUpdated:
    "We updated this qualification from your new transcript. Review the details below, then save when ready.",
  draftPartial:
    "We drafted a qualification from your transcript, but some details still need your input.",
  draftEmpty:
    "We couldn't draft a qualification from this transcript. Enter the details manually or try a clearer file.",
  draftHubEmpty:
    "We saved your transcript and ran an eligibility check, but couldn't draft a qualification from it. Complete the details manually.",
  draftHubSuccess:
    "We saved a qualification drafted from your transcript. Review the details below and check your eligibility results.",
  eligibilityTitle: "Checking course eligibility from your transcript...",
  eligibilityDetail: "This can take a little longer for larger files.",
  parsingTitle: "Reading your transcript and drafting your qualification...",
  savingQualificationTitle: "Saving your qualification...",
  savingQualificationDetail: "Please keep this tab open while we save your documents.",
  preservedExistingFields:
    "Transcript attached. Save to run an eligibility check on the qualifications page.",
} as const;

export function buildTranscriptEligibilityContext(
  applicationData: ApplicationData,
  formData: Pick<
    TertiaryQualification,
    "completed" | "country" | "institution" | "level"
  >,
): TranscriptEligibilityRequestContext {
  const selectedCourse = applicationData.applicationMeta.selectedCourse;
  const selectedCourseCatalogEntry = getCourseByCode(selectedCourse?.code);
  const parsedThresholds = parseEntryRequirementThresholds(
    selectedCourseCatalogEntry?.entryRequirements,
  );

  return {
    completed: formData.completed,
    country: formData.country,
    courseCode: selectedCourse?.code,
    courseTitle: selectedCourse?.title,
    entryRequirementsText: selectedCourseCatalogEntry?.entryRequirements,
    institution: formData.institution,
    languageTestsCount: applicationData.languageTests.length,
    level: formData.level,
    minGpaScale: parsedThresholds.minGpaScale,
    minGpaValue: parsedThresholds.minGpaValue,
    minWam: parsedThresholds.minWam,
    qualificationLevelRequirement: parsedThresholds.qualificationLevelRequirement,
    requirements: selectedCourseCatalogEntry?.requirements,
  };
}

export function shouldAutoFillQualificationFromTranscript(
  context: TertiaryTranscriptParseContext,
) {
  return Boolean(context.selectedTranscriptFile);
}

export function shouldReplaceQualificationFromTranscript(
  context: TertiaryTranscriptParseContext,
) {
  return (
    Boolean(context.selectedTranscriptFile) &&
    !isQualificationCoreEmpty(context.formData)
  );
}

export function shouldEvaluateTranscriptEligibility(
  context: TertiaryTranscriptParseContext,
) {
  return Boolean(context.selectedTranscriptFile);
}

export function needsHubTranscriptEligibilityProcessing(options: {
  selectedTranscriptFile: File | null;
  transcriptDocument?: UploadedDocument;
  transcriptEligibility?: TranscriptEligibilityAssessment;
  transcriptRemoved: boolean;
}) {
  if (options.transcriptRemoved) {
    return false;
  }

  if (options.selectedTranscriptFile) {
    return true;
  }

  return Boolean(options.transcriptDocument && !options.transcriptEligibility);
}

export function shouldUseCachedTranscriptAssessment(options: {
  cachedAssessment?: TranscriptEligibilityAssessment;
  hasParsedTranscriptFile?: (file: File) => boolean;
  transcriptFile?: File;
}) {
  return Boolean(
    options.cachedAssessment &&
      options.transcriptFile &&
      options.hasParsedTranscriptFile?.(options.transcriptFile),
  );
}

export async function parseTranscriptForQualification(
  file: File,
  context: TertiaryTranscriptParseContext,
): Promise<TertiaryTranscriptParseResult> {
  const shouldApplyDraft = shouldAutoFillQualificationFromTranscript(context);
  const eligibilityContext = buildTranscriptEligibilityContext(
    context.applicationData,
    context.formData,
  );

  let assessment: TranscriptEligibilityAssessment;

  try {
    assessment = await evaluateTranscriptEligibility(file, eligibilityContext);
  } catch (error) {
    const fallbackReason =
      error instanceof TranscriptEligibilityRequestError
        ? error.message
        : "Automatic transcript eligibility evaluation could not be completed.";

    assessment = createInsufficientDataAssessment({
      context: eligibilityContext,
      reason: fallbackReason,
    });
  }

  const fieldDraft = mapExtractedDataToQualification(assessment.extractedData);
  const mergedRecord = shouldApplyDraft
    ? mergeQualificationFromTranscriptParse(context.formData, fieldDraft)
    : context.formData;

  return {
    assessment,
    fieldDraft,
    mergedRecord,
    shouldAutoFill: shouldApplyDraft,
    replacedExistingFields:
      shouldApplyDraft &&
      shouldReplaceQualificationFromTranscript(context) &&
      qualificationFieldDraftDiffers(context.formData, fieldDraft),
  };
}

export function buildTertiaryTranscriptFlashMessage(options: {
  assessment?: TranscriptEligibilityAssessment;
  draftedFieldCount: number;
  parseError?: unknown;
  preservedExistingFields: boolean;
  validationFailed: boolean;
}) {
  const { assessment, draftedFieldCount, parseError, preservedExistingFields, validationFailed } =
    options;

  if (parseError) {
    return {
      message:
        parseError instanceof TranscriptEligibilityRequestError
          ? parseError.message
          : "We saved your transcript, but couldn't complete the automatic eligibility check.",
      type: "warning" as const,
    };
  }

  if (validationFailed) {
    return {
      message: tertiaryTranscriptParseCopy.draftPartial,
      type: "warning" as const,
    };
  }

  if (draftedFieldCount > 0) {
    const eligibilityNote = assessment
      ? ` Eligibility check: ${assessment.outcome.replace(/_/g, " ")}.`
      : "";
    return {
      message: `${tertiaryTranscriptParseCopy.draftHubSuccess}${eligibilityNote}`,
      type: "success" as const,
    };
  }

  if (preservedExistingFields) {
    return {
      message:
        "We saved your transcript and ran an eligibility check. Existing qualification details were left unchanged.",
      type: "status" as const,
    };
  }

  if (assessment) {
    if (assessment.outcome === "insufficient_data") {
      return {
        message: tertiaryTranscriptParseCopy.draftHubEmpty,
        type: "warning" as const,
      };
    }

    const eligibilityNote = ` Eligibility check: ${assessment.outcome.replace(/_/g, " ")}.`;
    return {
      message: `${tertiaryTranscriptParseCopy.draftHubSuccess}${eligibilityNote}`,
      type: "success" as const,
    };
  }

  return undefined;
}

export function countAppliedDraftFields(
  before: TertiaryQualification,
  after: TertiaryQualification,
) {
  let count = 0;
  if (!before.institution.trim() && after.institution.trim()) count += 1;
  if (!before.country.trim() && after.country.trim()) count += 1;
  if (!before.level && after.level) count += 1;
  if (!before.courseName.trim() && after.courseName.trim()) count += 1;
  if (!before.startMonth && after.startMonth) count += 1;
  if (!before.startYear && after.startYear) count += 1;
  if (!before.endMonth && after.endMonth) count += 1;
  if (!before.endYear && after.endYear) count += 1;
  return count;
}

export function getDraftedFieldCountFromParseResult(
  result: TertiaryTranscriptParseResult,
  previousRecord?: TertiaryQualification,
) {
  if (!result.shouldAutoFill) {
    return 0;
  }

  if (previousRecord) {
    return countQualificationDraftUpdates(previousRecord, result.mergedRecord);
  }

  return countDraftedFields(result.fieldDraft);
}

export type TertiaryDocumentSaveState = {
  certificateDocument?: UploadedDocument;
  certificateDocumentName?: string;
  transcriptDocument?: UploadedDocument;
  transcriptDocumentName?: string;
};
