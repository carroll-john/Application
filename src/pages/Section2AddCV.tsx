import { useMemo, useState } from "react";
import { StatusMessage } from "../components/StatusMessage";
import { useApplication } from "../context/ApplicationContext";
import {
  createCvDocumentParsePolicy,
  CvUploadFields,
  documentRemovalCopy,
  Section2RecordPage,
  Section2SaveProgressPanel,
  useSection2DocumentSaveWithParse,
} from "../features/section2";
import { isSection2DocumentRemoved } from "../features/section2/section2DocumentRemoval";
import { useCvEmploymentAutoFill } from "../features/section2/useCvEmploymentAutoFill";

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

  const {
    clearParseStatusMessage,
    handleSelectCvFile,
    hasParsedCvFile,
    isParsingCv,
    parseProgress,
    parseStatusMessage,
  } = useCvEmploymentAutoFill({
    employmentExperiences: data.employmentExperiences,
    replaceEmploymentExperiences,
  });

  const parseContextWithParseState = useMemo(
    () => ({
      ...parseContext,
      hasParsedCvFile,
    }),
    [hasParsedCvFile, parseContext],
  );

  const policy = useMemo(
    () => createCvDocumentParsePolicy({ replaceEmploymentExperiences }),
    [replaceEmploymentExperiences],
  );

  const hasDocument = Boolean(selectedFile) || Boolean(currentDocument);
  const canSave = hasDocument || currentDocument !== originalDocument;
  const cvMarkedForRemoval = isSection2DocumentRemoved({
    currentDocument,
    originalDocument,
    selectedFile,
  });

  const {
    clearStatusMessage,
    handleSaveAndContinue,
    isSaving,
    saveProgress,
    statusMessage,
  } = useSection2DocumentSaveWithParse({
    context: parseContextWithParseState,
    ensureApplicationRow,
    getCurrentDocument: (context) => context.currentDocument,
    getOriginalDocument: (context) => context.originalDocument,
    getSelectedFile: (context) => context.selectedFile,
    policy,
    removeDocument: removeCV,
    uploadDocument: uploadCV,
  });

  const activeStatusMessage = statusMessage ?? parseStatusMessage;
  const clearActiveStatusMessage = statusMessage
    ? clearStatusMessage
    : clearParseStatusMessage;
  const activeProgress = isSaving ? saveProgress : isParsingCv ? parseProgress : null;

  return (
    <Section2RecordPage
      addTitle="Upload your CV"
      continueDisabled={isSaving || isParsingCv || !canSave}
      continueLabel={isSaving ? "Saving..." : "Save & Continue"}
      description="Add your current CV or resume."
      editTitle="Upload your CV"
      isEditing={false}
      onContinue={handleSaveAndContinue}
    >
      <div className="space-y-6">
        {activeStatusMessage ? (
          <StatusMessage
            message={activeStatusMessage.message}
            type={activeStatusMessage.type}
            onDismiss={clearActiveStatusMessage}
          />
        ) : null}
        {cvMarkedForRemoval && data.employmentExperiences.length > 0 ? (
          <StatusMessage
            message={documentRemovalCopy.cvPendingWarning}
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
            setCurrentFileName(file?.name);
            void handleSelectCvFile(file);
          }}
        />
      </div>
    </Section2RecordPage>
  );
}
