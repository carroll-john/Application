import { useCallback, useMemo, useState } from "react";
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
} from "../features/section2";
import {
  canSaveTertiaryWithParseFirst,
  useSection2TertiarySaveWithParse,
} from "../features/section2/useSection2TertiarySaveWithParse";
import { useEditableRecord } from "../hooks/useEditableRecord";
import type { TertiaryQualification } from "../lib/applicationData";
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
  const { existing, isEditing, initialRecord } = useEditableRecord(
    data.tertiaryQualifications,
    () => ({
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

  const hasTranscript =
    Boolean(selectedTranscriptFile) ||
    Boolean(formData.transcriptDocument) ||
    Boolean(formData.transcriptDocumentName);
  const hasCertificate =
    Boolean(selectedCertificateFile) ||
    Boolean(formData.certificateDocument) ||
    Boolean(formData.certificateDocumentName);

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

  return (
    <Section2RecordPage
      addTitle="Add Tertiary Qualification"
      className="overflow-x-hidden"
      continueDisabled={isSaving || !canSave}
      continueLabel={isSaving ? "Saving..." : "Save & Continue"}
      description="Add the details of your university degree or diploma."
      editTitle="Edit Tertiary Qualification"
      isEditing={isEditing}
      navigateAfterSave={false}
      onContinue={handleSaveAndContinue}
      previousDisabled={isSaving}
    >
      <div className="space-y-6">
        {statusMessage ? (
          <StatusMessage
            message={statusMessage.message}
            type={statusMessage.type}
            onDismiss={clearStatusMessage}
          />
        ) : null}
        {isSaving && saveProgress ? (
          <Section2SaveProgressPanel
            detail={saveProgress.detail}
            title={saveProgress.title}
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
          onClearTranscriptFile={() => setSelectedTranscriptFile(null)}
          onSelectTranscriptFile={setSelectedTranscriptFile}
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
          hasCertificate={hasCertificate}
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
