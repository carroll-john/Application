import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FormActionBar } from "../components/FormActionBar";
import { FormSectionCard } from "../components/FormSectionCard";
import { SectionProgressHeader } from "../components/SectionProgressHeader";
import { FileUpload } from "../components/FileUpload";
import { useApplication } from "../context/ApplicationContext";
import { useReviewReturn } from "../hooks/useReviewReturn";
import {
  deleteStoredDocument,
  replaceStoredDocument,
  viewLocalDocument,
  viewStoredDocument,
} from "../lib/documentStorage";

export default function Section2AddCV() {
  const navigate = useNavigate();
  const { returnPath } = useReviewReturn();
  const { data, ensureRemoteRecordId, removeCV, uploadCV } = useApplication();
  const originalDocument = data.cvDocument;
  const [currentDocument, setCurrentDocument] = useState(data.cvDocument);
  const [currentFileName, setCurrentFileName] = useState(data.cvFileName);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const hasDocument =
    Boolean(selectedFile) || Boolean(currentDocument) || Boolean(currentFileName);

  async function handleSaveAndContinue() {
    if (selectedFile || currentDocument !== originalDocument) {
      setIsSaving(true);

      let savedDocument = currentDocument;
      const applicationId = await ensureRemoteRecordId();

      if (selectedFile) {
        savedDocument = await replaceStoredDocument(
          selectedFile,
          currentDocument ?? originalDocument,
          {
            applicationId,
            kind: "cv",
          },
        );
      } else if (!currentDocument && originalDocument) {
        await deleteStoredDocument(originalDocument);
      }

      if (savedDocument) {
        uploadCV(savedDocument);
      } else {
        removeCV();
      }
      setIsSaving(false);
    }

    navigate(returnPath("/section2/qualifications"));
  }

  const handlePrevious = () => navigate(returnPath("/section2/qualifications"));

  return (
    <div className="bg-gray-50 pb-12">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <SectionProgressHeader
          description="Add your current CV or resume."
          progress={66}
          sectionLabel="Section 2 of 3"
          title="Upload your CV"
        />

        <FormSectionCard className="lg:p-8">
          <div className="space-y-6">
            <FileUpload
              attachedDescription="Your CV or resume is attached. You can view or remove it below."
              className={
                hasDocument
                  ? "border-[var(--success-border)] bg-[linear-gradient(180deg,#ffffff_0%,#f7fcf9_100%)] shadow-[0_18px_40px_rgba(31,106,59,0.08)]"
                  : "border-[var(--info-border)] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbfd_100%)]"
              }
              description="Include your recent experience, skills, and achievements."
              fileName={selectedFile?.name || currentDocument?.name || currentFileName}
              fileSize={selectedFile?.size || currentDocument?.size}
              helperText=""
              label="CV or Resume"
              required
              onRemove={
                selectedFile || currentDocument
                  ? () => {
                      if (selectedFile) {
                        setSelectedFile(null);
                        return;
                      }

                      setCurrentDocument(undefined);
                      setCurrentFileName(undefined);
                    }
                  : undefined
              }
              onView={
                selectedFile
                  ? () => {
                      viewLocalDocument(selectedFile);
                    }
                  : currentDocument
                    ? () => {
                        void viewStoredDocument(currentDocument);
                      }
                  : undefined
              }
              onFileSelect={(file) => {
                setSelectedFile(file);
                setCurrentFileName(file.name);
              }}
            />
            <div className="flex items-center gap-2">
              <p
                className={`text-sm font-medium ${
                  hasDocument
                    ? "text-[var(--success-text)]"
                    : "text-[var(--info-text)]"
                }`}
              >
                {hasDocument
                  ? "CV attached"
                  : "Add your CV now, or come back to it later."}
              </p>
            </div>

            <div className="rounded-lg border border-[var(--info-border)] bg-[var(--info-bg)] p-4">
              <p className="mb-2 text-sm font-medium text-[var(--info-text)]">
                Keep your CV:
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--info-text)]">
                <li>current and accurate</li>
                <li>focused on recent experience</li>
                <li>clearly named</li>
              </ul>
            </div>
          </div>
        </FormSectionCard>

        <FormActionBar
          previousDisabled={isSaving}
          previousLabel="Cancel"
          primaryDisabled={isSaving}
          primaryLabel={isSaving ? "Saving..." : "Save & Continue"}
          onPrevious={handlePrevious}
          onPrimary={handleSaveAndContinue}
        />
      </div>
    </div>
  );
}
