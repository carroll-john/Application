import { useCallback, useState } from "react";
import { useApplication } from "../context/ApplicationContext";
import {
  Section2RecordPage,
  TertiaryDocumentFields,
  TertiaryInstitutionFields,
  TertiaryQualificationFields,
  TertiaryStudyPeriodFields,
} from "../features/section2";
import { useEditableRecord } from "../hooks/useEditableRecord";
import { useSection2RecordSave } from "../hooks/useSection2RecordSave";
import type { TertiaryQualification } from "../lib/applicationData";
import { saveDocumentAttachment } from "../lib/documentAttachment";
import { isMonthYearRangeOutOfOrder } from "../lib/monthYearValidation";

export default function Section2AddTertiary() {
  const {
    data,
    ensureRemoteRecordId,
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

  const missingRequiredFields = [
    !formData.institution.trim() && "Institution Name",
    !formData.country && "Country",
    !formData.level && "Qualification Level",
    !formData.courseName.trim() && "Course Name",
    (!formData.startMonth || !formData.startYear) && "Start date",
    (!formData.endMonth || !formData.endYear) && "End date",
  ].filter(Boolean) as string[];
  const dateRangeError = isMonthYearRangeOutOfOrder(
    formData.startMonth,
    formData.startYear,
    formData.endMonth,
    formData.endYear,
  )
    ? "Start date must be before or the same as end date."
    : null;

  const saveRecord = async () => {
    const transcriptRemoved =
      !selectedTranscriptFile &&
      !formData.transcriptDocument &&
      Boolean(originalTranscriptDocument);
    const certificateRemoved =
      !selectedCertificateFile &&
      !formData.certificateDocument &&
      Boolean(originalCertificateDocument);

    const applicationId = await ensureRemoteRecordId();
    const transcriptDocument = await saveDocumentAttachment({
      applicationId,
      currentDocument: transcriptRemoved ? undefined : formData.transcriptDocument,
      kind: "tertiary_transcript",
      originalDocument: originalTranscriptDocument,
      selectedFile: selectedTranscriptFile,
    });
    const certificateDocument = await saveDocumentAttachment({
      applicationId,
      currentDocument: certificateRemoved ? undefined : formData.certificateDocument,
      kind: "tertiary_certificate",
      originalDocument: originalCertificateDocument,
      selectedFile: selectedCertificateFile,
    });

    const nextRecord = {
      ...formData,
      transcriptDocument,
      transcriptDocumentName:
        transcriptDocument?.name ?? formData.transcriptDocumentName,
      certificateDocument: formData.completed ? certificateDocument : undefined,
      certificateDocumentName: formData.completed
        ? certificateDocument?.name ?? formData.certificateDocumentName
        : undefined,
    };

    if (existing) {
      updateTertiaryQualification(existing.id, nextRecord);
    } else {
      addTertiaryQualification(nextRecord);
    }
  };

  const validateBeforeContinue = useCallback(() => {
    setShowValidation(true);
    return missingRequiredFields.length === 0 && !dateRangeError;
  }, [dateRangeError, missingRequiredFields.length]);

  const { statusMessage, clearStatusMessage, handleSaveAndReturn } =
    useSection2RecordSave({
      beforeContinue: validateBeforeContinue,
      errorFallbackMessage:
        "We couldn't save this qualification right now. Please try again.",
      saveRecord,
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
      description="Add the details of your university degree or diploma."
      editTitle="Edit Tertiary Qualification"
      isEditing={isEditing}
      navigateAfterSave={false}
      statusMessage={statusMessage}
      onDismissStatus={clearStatusMessage}
      onSave={handleSaveAndReturn}
    >
      <div className="space-y-6">
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
          hasTranscript={hasTranscript}
          selectedCertificateFile={selectedCertificateFile}
          selectedTranscriptFile={selectedTranscriptFile}
          onClearCertificateDocument={() =>
            setFormData((previous) => ({
              ...previous,
              certificateDocument: undefined,
              certificateDocumentName: undefined,
            }))
          }
          onClearCertificateFile={() => setSelectedCertificateFile(null)}
          onClearTranscriptDocument={() =>
            setFormData((previous) => ({
              ...previous,
              transcriptDocument: undefined,
              transcriptDocumentName: undefined,
            }))
          }
          onClearTranscriptFile={() => setSelectedTranscriptFile(null)}
          onSelectCertificateFile={setSelectedCertificateFile}
          onSelectTranscriptFile={setSelectedTranscriptFile}
        />
      </div>
    </Section2RecordPage>
  );
}
