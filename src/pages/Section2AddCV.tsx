import { useMemo, useState } from "react";
import { StatusMessage } from "../components/StatusMessage";
import { useApplication } from "../context/ApplicationContext";
import {
  createCvDocumentParsePolicy,
  CvUploadFields,
  Section2RecordPage,
  Section2SaveProgressPanel,
  useSection2DocumentSaveWithParse,
} from "../features/section2";

export default function Section2AddCV() {
  const {
    data,
    ensureApplicationRow,
    removeCV,
    replaceEmploymentExperiences,
    uploadCV,
  } = useApplication();
  const originalDocument = data.cvDocument;
  const [currentDocument, setCurrentDocument] = useState(data.cvDocument);
  const [currentFileName, setCurrentFileName] = useState(data.cvFileName);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const parseContext = useMemo(
    () => ({
      currentDocument,
      employmentExperiences: data.employmentExperiences,
      originalDocument,
      selectedFile,
    }),
    [
      currentDocument,
      data.employmentExperiences,
      originalDocument,
      selectedFile,
    ],
  );

  const policy = useMemo(
    () => createCvDocumentParsePolicy({ replaceEmploymentExperiences }),
    [replaceEmploymentExperiences],
  );

  const hasDocument = Boolean(selectedFile) || Boolean(currentDocument);
  const canSave = hasDocument || currentDocument !== originalDocument;

  const {
    clearStatusMessage,
    handleSaveAndContinue,
    isSaving,
    saveProgress,
    statusMessage,
  } = useSection2DocumentSaveWithParse({
    context: parseContext,
    ensureApplicationRow,
    getCurrentDocument: (context) => context.currentDocument,
    getOriginalDocument: (context) => context.originalDocument,
    getSelectedFile: (context) => context.selectedFile,
    policy,
    removeDocument: removeCV,
    uploadDocument: uploadCV,
  });

  return (
    <Section2RecordPage
      addTitle="Upload your CV"
      continueDisabled={isSaving || !canSave}
      continueLabel={isSaving ? "Saving..." : "Save & Continue"}
      description="Add your current CV or resume."
      editTitle="Upload your CV"
      isEditing={false}
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
        <CvUploadFields
          currentDocument={currentDocument}
          currentFileName={currentFileName}
          hasDocument={hasDocument}
          selectedFile={selectedFile}
          onClearDocument={() => {
            setCurrentDocument(undefined);
            setCurrentFileName(undefined);
          }}
          onClearSelectedFile={() => setSelectedFile(null)}
          onFileSelect={(file) => {
            setSelectedFile(file);
            setCurrentFileName(file.name);
          }}
        />
      </div>
    </Section2RecordPage>
  );
}
