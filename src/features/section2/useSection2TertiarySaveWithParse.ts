import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ApplicationData, TertiaryQualification } from "../../lib/applicationData";
import { getDocumentUploadErrorMessage } from "../../lib/documentStorage";
import type { UploadedDocument } from "../../lib/documentStorage";
import { trackTertiaryTranscriptParserSaveContinueClicked } from "../../lib/analytics/tertiaryTranscriptParserAnalytics";
import { isQualificationCoreEmpty } from "../../lib/eligibility/mapToTertiaryQualification";
import { clearTertiaryQualificationFromTranscript } from "../../lib/eligibility/mapToTertiaryQualification";
import { useSection2Navigation } from "../../hooks/useSection2Navigation";
import type { Section2RecordStatusMessage } from "../../hooks/useSection2RecordSave";
import { saveSection2DocumentRecord } from "./section2DocumentSave";
import { confirmDocumentRemoval, documentRemovalCopy } from "./documentRemovalCopy";
import type { Section2NavigationState } from "./section2NavigationState";
import {
  buildTertiaryTranscriptFlashMessage,
  needsHubTranscriptEligibilityProcessing,
  shouldUseCachedTranscriptAssessment,
  tertiaryTranscriptParseCopy,
} from "./tertiaryTranscriptParsePolicy";

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

    const transcriptRemoved =
      !selectedTranscriptFile &&
      !formData.transcriptDocument &&
      Boolean(originalTranscriptDocument);

    if (
      transcriptRemoved &&
      !isQualificationCoreEmpty(formData) &&
      !confirmDocumentRemoval(documentRemovalCopy.transcriptConfirm)
    ) {
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);
    setSaveProgress({
      detail: tertiaryTranscriptParseCopy.savingQualificationDetail,
      title: tertiaryTranscriptParseCopy.savingQualificationTitle,
    });

    try {
      const applicationId = await ensureApplicationRow();
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
        workingRecord = clearTertiaryQualificationFromTranscript(workingRecord);
      }

      const deferEligibilityToHub = needsHubTranscriptEligibilityProcessing({
        selectedTranscriptFile,
        transcriptDocument: workingRecord.transcriptDocument,
        transcriptEligibility: workingRecord.transcriptEligibility,
        transcriptRemoved,
      });

      if (deferEligibilityToHub) {
        workingRecord = {
          ...workingRecord,
          transcriptEligibility: undefined,
        };
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

      if (validationFailed && !parseFirst && !deferEligibilityToHub) {
        setSaveProgress(null);
        setStatusMessage({
          message: tertiaryTranscriptParseCopy.draftPartial,
          type: "warning",
        });
        return;
      }

      const navigationState: Section2NavigationState = {};

      if (deferEligibilityToHub) {
        navigationState.pendingTranscriptEligibility = {
          qualificationId: workingRecord.id,
          savedQualification: workingRecord,
          transcriptFile: selectedTranscriptFile ?? undefined,
          cachedAssessment: shouldUseCachedTranscriptAssessment({
            cachedAssessment: formData.transcriptEligibility,
            hasParsedTranscriptFile,
            transcriptFile: selectedTranscriptFile ?? undefined,
          })
            ? formData.transcriptEligibility
            : undefined,
        };
      } else {
        const flashMessage = buildTertiaryTranscriptFlashMessage({
          draftedFieldCount: 0,
          preservedExistingFields: false,
          validationFailed: false,
        });

        if (flashMessage) {
          navigationState.section2StatusMessage = flashMessage;
        }
      }

      navigate(qualificationsPath, {
        state: Object.keys(navigationState).length > 0 ? navigationState : undefined,
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
    hasParsedTranscriptFile,
    navigate,
    originalCertificateDocument,
    originalTranscriptDocument,
    qualificationsPath,
    selectedCertificateFile,
    selectedTranscriptFile,
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
