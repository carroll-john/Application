import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ApplicationData, TertiaryQualification } from "../../lib/applicationData";
import { getDocumentUploadErrorMessage } from "../../lib/documentStorage";
import type { UploadedDocument } from "../../lib/documentStorage";
import {
  getTertiaryTranscriptParserErrorCode,
  trackTertiaryTranscriptParserDraftEmpty,
  trackTertiaryTranscriptParserDraftFailed,
  trackTertiaryTranscriptParserDraftSucceeded,
  trackTertiaryTranscriptParserSaveContinueClicked,
} from "../../lib/analytics/tertiaryTranscriptParserAnalytics";
import { isQualificationCoreEmpty } from "../../lib/eligibility/mapToTertiaryQualification";
import { useSection2Navigation } from "../../hooks/useSection2Navigation";
import type { Section2RecordStatusMessage } from "../../hooks/useSection2RecordSave";
import { saveSection2DocumentRecord } from "./section2DocumentSave";
import {
  buildTertiaryTranscriptFlashMessage,
  getDraftedFieldCountFromParseResult,
  parseTranscriptForQualification,
  shouldEvaluateTranscriptEligibility,
  tertiaryTranscriptParseCopy,
  type TertiaryTranscriptParseContext,
} from "./tertiaryTranscriptParsePolicy";

export type TertiarySaveProgressStage =
  | "saving"
  | "parsing"
  | "applying"
  | "finalising";

const PROGRESS_COPY: Record<
  TertiarySaveProgressStage,
  { detail: string; title: string }
> = {
  saving: {
    detail: "Please keep this tab open while we save your documents.",
    title: "Saving your transcript...",
  },
  parsing: {
    detail: "This can take a little longer for larger files.",
    title: tertiaryTranscriptParseCopy.parsingTitle,
  },
  applying: {
    detail: "Almost done.",
    title: "Applying qualification draft...",
  },
  finalising: {
    detail: "Taking you to the next step.",
    title: "Finalising...",
  },
};

interface UseSection2TertiarySaveWithParseOptions {
  addTertiaryQualification: (qualification: TertiaryQualification) => Promise<void>;
  applicationData: ApplicationData;
  ensureApplicationRow: () => Promise<string>;
  existingId?: string;
  formData: TertiaryQualification;
  hasParsedTranscriptFile?: (file: File) => boolean;
  originalCertificateDocument?: UploadedDocument;
  originalTranscriptDocument?: UploadedDocument;
  selectedCertificateFile: File | null;
  selectedTranscriptFile: File | null;
  setFormData: (record: TertiaryQualification) => void;
  setShowValidation: (show: boolean) => void;
  updateTertiaryQualification: (
    id: string,
    qualification: TertiaryQualification,
  ) => Promise<void>;
  validateRecord: (record: TertiaryQualification) => boolean;
}

export function canSaveTertiaryWithParseFirst(options: {
  formData: TertiaryQualification;
  selectedTranscriptFile: File | null;
  validateRecord: (record: TertiaryQualification) => boolean;
}) {
  if (options.selectedTranscriptFile && isQualificationCoreEmpty(options.formData)) {
    return true;
  }

  return options.validateRecord(options.formData);
}

export function useSection2TertiarySaveWithParse({
  addTertiaryQualification,
  applicationData,
  ensureApplicationRow,
  existingId,
  formData,
  hasParsedTranscriptFile,
  originalCertificateDocument,
  originalTranscriptDocument,
  selectedCertificateFile,
  selectedTranscriptFile,
  setFormData,
  setShowValidation,
  updateTertiaryQualification,
  validateRecord,
}: UseSection2TertiarySaveWithParseOptions) {
  const navigate = useNavigate();
  const { qualificationsPath } = useSection2Navigation();
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState<{
    detail: string;
    title: string;
  } | null>(null);
  const [statusMessage, setStatusMessage] =
    useState<Section2RecordStatusMessage | null>(null);

  const clearStatusMessage = useCallback(() => {
    setStatusMessage(null);
  }, []);

  const handleSaveAndContinue = useCallback(async () => {
    const parseContext: TertiaryTranscriptParseContext = {
      applicationData,
      formData,
      selectedTranscriptFile,
    };

    const parseFirst =
      Boolean(selectedTranscriptFile) && isQualificationCoreEmpty(formData);

    trackTertiaryTranscriptParserSaveContinueClicked({
      hasSelectedTranscript: Boolean(selectedTranscriptFile),
      isCoreEmpty: isQualificationCoreEmpty(formData),
    });

    if (!parseFirst && !validateRecord(formData)) {
      setShowValidation(true);
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);
    setSaveProgress(PROGRESS_COPY.saving);

    const shouldEvaluate = shouldEvaluateTranscriptEligibility(parseContext);
    let parseStartedAt: number | null = null;
    let parseError: unknown;
    let parseResult: Awaited<ReturnType<typeof parseTranscriptForQualification>> | undefined;

    if (shouldEvaluate && selectedTranscriptFile) {
      parseStartedAt = Date.now();
    }

    try {
      const applicationId = await ensureApplicationRow();
      const transcriptRemoved =
        !selectedTranscriptFile &&
        !formData.transcriptDocument &&
        Boolean(originalTranscriptDocument);
      const certificateRemoved =
        !selectedCertificateFile &&
        !formData.certificateDocument &&
        Boolean(originalCertificateDocument);

      const { document: transcriptDocument, documentName: transcriptDocumentName } =
        await saveSection2DocumentRecord({
          applicationId,
          currentDocument: transcriptRemoved ? undefined : formData.transcriptDocument,
          ensureApplicationRow: async () => applicationId,
          kind: "tertiary_transcript",
          originalDocument: originalTranscriptDocument,
          selectedFile: selectedTranscriptFile,
        });

      const { document: certificateDocument, documentName: certificateDocumentName } =
        await saveSection2DocumentRecord({
          applicationId,
          currentDocument: certificateRemoved ? undefined : formData.certificateDocument,
          ensureApplicationRow: async () => applicationId,
          kind: "tertiary_certificate",
          originalDocument: originalCertificateDocument,
          selectedFile: selectedCertificateFile,
        });

      let workingRecord: TertiaryQualification = {
        ...formData,
        transcriptDocument,
        transcriptDocumentName: transcriptDocumentName ?? formData.transcriptDocumentName,
        certificateDocument: formData.completed ? certificateDocument : undefined,
        certificateDocumentName: formData.completed
          ? certificateDocumentName ?? formData.certificateDocumentName
          : undefined,
      };

      if (transcriptRemoved) {
        workingRecord = {
          ...workingRecord,
          transcriptEligibility: undefined,
        };
      } else if (shouldEvaluate && selectedTranscriptFile) {
        const alreadyParsedOnUpload =
          Boolean(formData.transcriptEligibility) &&
          (hasParsedTranscriptFile?.(selectedTranscriptFile) ?? false);

        if (alreadyParsedOnUpload) {
          workingRecord = {
            ...formData,
            transcriptDocument,
            transcriptDocumentName:
              transcriptDocumentName ?? formData.transcriptDocumentName,
            certificateDocument: formData.completed ? certificateDocument : undefined,
            certificateDocumentName: formData.completed
              ? certificateDocumentName ?? formData.certificateDocumentName
              : undefined,
          };
        } else {
        setSaveProgress({
          ...PROGRESS_COPY.parsing,
          title: tertiaryTranscriptParseCopy.parsingTitle,
        });

        try {
          parseResult = await parseTranscriptForQualification(
            selectedTranscriptFile,
            {
              ...parseContext,
              formData: workingRecord,
            },
          );
        } catch (error) {
          parseError = error;
          const parseDurationMs =
            parseStartedAt === null ? undefined : Date.now() - parseStartedAt;
          trackTertiaryTranscriptParserDraftFailed({
            errorCode: getTertiaryTranscriptParserErrorCode(error),
            parseDurationMs,
          });
        }

        if (parseResult) {
          setSaveProgress(PROGRESS_COPY.applying);
          workingRecord = {
            ...parseResult.mergedRecord,
            transcriptDocument,
            transcriptDocumentName:
              transcriptDocumentName ?? parseResult.mergedRecord.transcriptDocumentName,
            certificateDocument: parseResult.mergedRecord.completed
              ? certificateDocument
              : undefined,
            certificateDocumentName: parseResult.mergedRecord.completed
              ? certificateDocumentName ?? formData.certificateDocumentName
              : undefined,
            transcriptEligibility: parseResult.assessment,
          };
          setFormData(workingRecord);

          const parseDurationMs =
            parseStartedAt === null ? undefined : Date.now() - parseStartedAt;
          const draftedFieldCount = getDraftedFieldCountFromParseResult(parseResult);

          if (draftedFieldCount > 0) {
            trackTertiaryTranscriptParserDraftSucceeded({
              draftedFieldCount,
              eligibilityOutcome: parseResult.assessment.outcome,
              parseDurationMs,
            });
          } else if (parseResult.shouldAutoFill) {
            trackTertiaryTranscriptParserDraftEmpty({ parseDurationMs });
          }
        }
        }
      }

      const validationFailed = !validateRecord(workingRecord);
      if (validationFailed) {
        setShowValidation(true);
      }

      const alreadyPersisted =
        Boolean(existingId) ||
        applicationData.tertiaryQualifications.some(
          (qualification) => qualification.id === workingRecord.id,
        );

      if (alreadyPersisted) {
        await updateTertiaryQualification(
          existingId ?? workingRecord.id,
          workingRecord,
        );
      } else {
        await addTertiaryQualification(workingRecord);
      }

      if (validationFailed) {
        setSaveProgress(null);
        setStatusMessage({
          message: tertiaryTranscriptParseCopy.draftPartial,
          type: "warning",
        });
        return;
      }

      setSaveProgress(PROGRESS_COPY.finalising);
      const flashMessage = buildTertiaryTranscriptFlashMessage({
        assessment: parseResult?.assessment,
        draftedFieldCount: parseResult
          ? getDraftedFieldCountFromParseResult(parseResult)
          : 0,
        parseError,
        preservedExistingFields: Boolean(
          parseResult && !parseResult.shouldAutoFill && selectedTranscriptFile,
        ),
        validationFailed: false,
      });

      navigate(qualificationsPath, {
        state: flashMessage ? { section2StatusMessage: flashMessage } : undefined,
      });
    } catch (error) {
      setSaveProgress(null);
      setStatusMessage({
        message:
          getDocumentUploadErrorMessage(error) ??
          "We couldn't save this qualification right now. Please try again.",
        type: "error",
      });
    } finally {
      setIsSaving(false);
      setSaveProgress(null);
    }
  }, [
    addTertiaryQualification,
    applicationData,
    ensureApplicationRow,
    existingId,
    formData,
    navigate,
    hasParsedTranscriptFile,
    originalCertificateDocument,
    originalTranscriptDocument,
    qualificationsPath,
    selectedCertificateFile,
    selectedTranscriptFile,
    setFormData,
    setShowValidation,
    updateTertiaryQualification,
    validateRecord,
  ]);

  return {
    clearStatusMessage,
    handleSaveAndContinue,
    isSaving,
    saveProgress,
    statusMessage,
  };
}
