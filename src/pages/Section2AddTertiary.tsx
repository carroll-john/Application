import { useCallback, useEffect, useMemo, useState } from "react";
import { StatusMessage } from "../components/StatusMessage";
import { useApplication } from "../context/ApplicationContext";
import {
  Section2RecordPage,
  Section2SaveProgressPanel,
  TertiaryDocumentFields,
  TertiaryInstitutionFields,
  TertiaryQualificationFields,
  TertiaryStudyPeriodFields,
  TertiaryTranscriptUploadCard,
  documentRemovalCopy,
} from "../features/section2";
import { isSection2DocumentRemoved } from "../features/section2/section2DocumentRemoval";
import {
  canSaveTertiaryWithParseFirst,
  useSection2TertiarySaveWithParse,
} from "../features/section2/useSection2TertiarySaveWithParse";
import { useTertiaryTranscriptAutoFill } from "../features/section2/useTertiaryTranscriptAutoFill";
import { useEditableRecord } from "../hooks/useEditableRecord";
import type { TertiaryQualification } from "../lib/applicationData";
import { isQualificationCoreEmpty } from "../lib/eligibility/mapToTertiaryQualification";
import { isMonthYearRangeOutOfOrder } from "../lib/monthYearValidation";

function validateTertiaryRecord(record: TertiaryQualification) {
  const missingRequiredFields = [
    !record.institution.trim(),
    !record.country,
    !record.level,
    !record.courseName.trim(),
    !record.startMonth || !record.startYear,
    !record.endMonth || !record.endYear,
  ].filter(Boolean);

  const dateRangeError = isMonthYearRangeOutOfOrder(
    record.startMonth,
    record.startYear,
    record.endMonth,
    record.endYear,
  );

  return missingRequiredFields.length === 0 && !dateRangeError;
}

export default function Section2AddTertiary() {
  const {
    data,
    ensureApplicationRow,
    addTertiaryQualification,
    updateTertiaryQualification,
  } = useApplication();
  const createDefaultRecord = useCallback(
    (): TertiaryQualification => ({
      id: crypto.randomUUID(),
      institution: "",
      country: "Australia",
      level: "",
      courseName: "",
      startMonth: "",
      startYear: "",
      completed: true,
      endMonth: "",
      endYear: "",
      transcriptDocument: undefined,
      transcriptDocumentName: undefined,
      certificateDocument: undefined,
      certificateDocumentName: undefined,
    }),
    [],
  );
  const { existing, isEditing, initialRecord } = useEditableRecord(
    data.tertiaryQualifications,
    createDefaultRecord,
  );
  const originalTranscriptDocument = existing?.transcriptDocument;
  const originalCertificateDocument = existing?.certificateDocument;

  const [formData, setFormData] = useState(initialRecord);
  const [selectedTranscriptFile, setSelectedTranscriptFile] = useState<File | null>(
    null,
  );
  const [selectedCertificateFile, setSelectedCertificateFile] =
    useState<File | null>(null);
  const [showValidation, setShowValidation] = useState(false);

  useEffect(() => {
    setFormData(initialRecord);
    setSelectedTranscriptFile(null);
    setSelectedCertificateFile(null);
    setShowValidation(false);
  }, [initialRecord]);

  const {
    clearParseStatusMessage,
    handleSelectTranscriptFile: parseTranscriptOnSelect,
    hasParsedTranscriptFile,
    isParsingTranscript,
    parseProgress,
    parseStatusMessage,
  } = useTertiaryTranscriptAutoFill({
    applicationData: data,
    formData,
    setFormData,
  });

  const hasTranscript =
    Boolean(selectedTranscriptFile) ||
    Boolean(formData.transcriptDocument) ||
    Boolean(formData.transcriptDocumentName);

  const transcriptMarkedForRemoval = isSection2DocumentRemoved({
    currentDocument: formData.transcriptDocument,
    originalDocument: originalTranscriptDocument,
    selectedFile: selectedTranscriptFile,
  });

  const missingRequiredFields = useMemo(() => {
    return [
      !formData.institution.trim() && "Institution Name",
      !formData.country && "Country",
      !formData.level && "Qualification Level",
      !formData.courseName.trim() && "Course Name",
      (!formData.startMonth || !formData.startYear) && "Start date",
      (!formData.endMonth || !formData.endYear) && "End date",
    ].filter(Boolean) as string[];
  }, [formData]);

  const dateRangeError = isMonthYearRangeOutOfOrder(
    formData.startMonth,
    formData.startYear,
    formData.endMonth,
    formData.endYear,
  )
    ? "Start date must be before or the same as end date."
    : null;

  const validateRecord = useCallback(
    (record: TertiaryQualification) => validateTertiaryRecord(record),
    [],
  );

  const {
    clearStatusMessage,
    handleSaveAndContinue,
    isSaving,
    saveProgress,
    statusMessage,
  } = useSection2TertiarySaveWithParse({
    addTertiaryQualification,
    applicationData: data,
    ensureApplicationRow,
    existingId: existing?.id,
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
  });

  const canSave = canSaveTertiaryWithParseFirst({
    formData,
    selectedTranscriptFile,
    validateRecord,
  });

  const onFormChange = useCallback(
    (updater: (previous: TertiaryQualification) => TertiaryQualification) => {
      setFormData(updater);
    },
    [],
  );

  const onSelectTranscriptFile = useCallback(
    (file: File | null) => {
      setSelectedTranscriptFile(file);
      void parseTranscriptOnSelect(file);
    },
    [parseTranscriptOnSelect],
  );

  const activeStatusMessage = statusMessage ?? parseStatusMessage;
  const clearActiveStatusMessage = statusMessage
    ? clearStatusMessage
    : clearParseStatusMessage;
  const activeProgress = isSaving ? saveProgress : isParsingTranscript ? parseProgress : null;

  return (
    <Section2RecordPage
      addTitle="Add Tertiary Qualification"
      className="overflow-x-hidden"
      continueDisabled={isSaving || isParsingTranscript || !canSave}
      continueLabel={isSaving ? "Saving..." : "Save & Continue"}
      description="Add the details of your university degree or diploma."
      editTitle="Edit Tertiary Qualification"
      isEditing={isEditing}
      navigateAfterSave={false}
      onContinue={handleSaveAndContinue}
      previousDisabled={isSaving || isParsingTranscript}
    >
      <div className="space-y-6">
        {activeStatusMessage ? (
          <StatusMessage
            message={activeStatusMessage.message}
            type={activeStatusMessage.type}
            onDismiss={clearActiveStatusMessage}
          />
        ) : null}
        {transcriptMarkedForRemoval && !isQualificationCoreEmpty(formData) ? (
          <StatusMessage
            message={documentRemovalCopy.transcriptPendingWarning}
            onDismiss={() => undefined}
            type="warning"
          />
        ) : null}
        {activeProgress ? (
          <Section2SaveProgressPanel
            detail={activeProgress.detail}
            title={activeProgress.title}
          />
        ) : null}
        <TertiaryTranscriptUploadCard
          formData={formData}
          hasTranscript={hasTranscript}
          selectedTranscriptFile={selectedTranscriptFile}
          onClearTranscriptDocument={() =>
            setFormData((previous) => ({
              ...previous,
              transcriptDocument: undefined,
              transcriptDocumentName: undefined,
              transcriptEligibility: undefined,
            }))
          }
          onClearTranscriptFile={() => onSelectTranscriptFile(null)}
          onSelectTranscriptFile={onSelectTranscriptFile}
        />
        <TertiaryInstitutionFields formData={formData} onFormChange={onFormChange} />
        <TertiaryQualificationFields formData={formData} onFormChange={onFormChange} />
        <TertiaryStudyPeriodFields
          dateRangeError={dateRangeError}
          formData={formData}
          missingEndDate={missingRequiredFields.includes("End date")}
          onFormChange={onFormChange}
          showValidation={showValidation}
        />
        <TertiaryDocumentFields
          formData={formData}
          selectedCertificateFile={selectedCertificateFile}
          onClearCertificateDocument={() =>
            setFormData((previous) => ({
              ...previous,
              certificateDocument: undefined,
              certificateDocumentName: undefined,
            }))
          }
          onClearCertificateFile={() => setSelectedCertificateFile(null)}
          onSelectCertificateFile={setSelectedCertificateFile}
        />
      </div>
    </Section2RecordPage>
  );
}
