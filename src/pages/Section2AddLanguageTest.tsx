import { useState } from "react";
import { DocumentUploadField } from "../components/DocumentUploadField";
import { StatusMessage } from "../components/StatusMessage";
import { YearPickerField } from "../components/ui/date-controls";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { NativeSelect } from "../components/ui/native-select";
import { useApplication } from "../context/ApplicationContext";
import { Section2FormCard, Section2RecordPage } from "../features/section2";
import { useEditableRecord } from "../hooks/useEditableRecord";
import { useSection2Navigation } from "../hooks/useSection2Navigation";
import { saveDocumentAttachment } from "../lib/documentAttachment";
import { getDocumentUploadErrorMessage } from "../lib/documentStorage";
import { years } from "../lib/formOptions";

export default function Section2AddLanguageTest() {
  const { returnToQualifications } = useSection2Navigation();
  const { data, ensureRemoteRecordId, addLanguageTest, updateLanguageTest } =
    useApplication();
  const { existing, isEditing, initialRecord } = useEditableRecord(
    data.languageTests,
    () => ({
      id: crypto.randomUUID(),
      type: "",
      name: "",
      year: "",
      document: undefined,
      documentName: undefined,
    }),
  );

  const [formData, setFormData] = useState(initialRecord);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    message: string;
    type: "success" | "warning" | "error" | "status";
  } | null>(null);
  const originalDocument = existing?.document;

  const saveRecord = async () => {
    const applicationId = await ensureRemoteRecordId();
    const document = await saveDocumentAttachment({
      applicationId,
      currentDocument: formData.document,
      kind: "language_test_document",
      originalDocument,
      selectedFile,
    });

    const nextRecord = {
      ...formData,
      document,
      documentName: document?.name,
    };

    if (existing) {
      updateLanguageTest(existing.id, nextRecord);
    } else {
      addLanguageTest(nextRecord);
    }
  };

  return (
    <Section2RecordPage
      addTitle="Add English Language Test"
      description="Add your English language test details."
      editTitle="Edit English Language Test"
      isEditing={isEditing}
      onContinue={async () => {
        setStatusMessage(null);

        try {
          await saveRecord();
          returnToQualifications();
        } catch (error) {
          setStatusMessage({
            message:
              getDocumentUploadErrorMessage(error) ??
              "We couldn't save this language test right now. Please try again.",
            type: "error",
          });
        }
      }}
    >
      {statusMessage ? (
        <div className="mb-6">
          <StatusMessage
            message={statusMessage.message}
            type={statusMessage.type}
            onDismiss={() => setStatusMessage(null)}
          />
        </div>
      ) : null}

      <Section2FormCard>
        <div className="space-y-6">
          <div>
            <Label>Test Type *</Label>
            <NativeSelect
              value={formData.type}
              onChange={(event) =>
                setFormData((previous) => ({
                  ...previous,
                  type: event.target.value,
                }))
              }
            >
              <option value="">Select test type</option>
              <option value="IELTS">IELTS</option>
              <option value="TOEFL">TOEFL</option>
              <option value="PTE">PTE Academic</option>
              <option value="Cambridge">Cambridge English</option>
              <option value="Duolingo">Duolingo English Test</option>
              <option value="Other">Other</option>
            </NativeSelect>
          </div>
          <div>
            <Label>Test Name/Details *</Label>
            <Input
              placeholder="e.g. IELTS Academic"
              value={formData.name}
              onChange={(event) =>
                setFormData((previous) => ({
                  ...previous,
                  name: event.target.value,
                }))
              }
            />
          </div>
          <div>
            <Label>Test Year *</Label>
            <YearPickerField
              description="Choose the year you took this test."
              label="Test year"
              title="Select test year"
              value={formData.year}
              years={years}
              onChange={(year) =>
                setFormData((previous) => ({
                  ...previous,
                  year,
                }))
              }
            />
          </div>

          <DocumentUploadField
            attachedDescription="Your test results document is attached. You can view or remove it below."
            attachedStatus="Results document attached"
            description="Upload the score report or official result."
            document={formData.document}
            documentName={formData.documentName}
            label="Test Results Document"
            missingStatus="Add your score report now, or come back to it later."
            onClearDocument={() =>
              setFormData((previous) => ({
                ...previous,
                document: undefined,
                documentName: undefined,
              }))
            }
            onClearSelectedFile={() => setSelectedFile(null)}
            onFileSelect={setSelectedFile}
            selectedFile={selectedFile}
          />

          <div className="rounded-lg border border-[var(--info-border)] bg-[var(--info-bg)] p-4">
            <p className="text-sm text-[var(--info-text)]">
              <strong>Note:</strong> Check that your score meets the course requirement.
            </p>
          </div>
        </div>
      </Section2FormCard>
    </Section2RecordPage>
  );
}
