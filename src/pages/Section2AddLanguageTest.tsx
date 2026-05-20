import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DocumentUploadField } from "../components/DocumentUploadField";
import { FormActionBar } from "../components/FormActionBar";
import { FormSectionCard } from "../components/FormSectionCard";
import { SectionProgressHeader } from "../components/SectionProgressHeader";
import { StatusMessage } from "../components/StatusMessage";
import { YearPickerField } from "../components/ui/date-controls";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { NativeSelect } from "../components/ui/native-select";
import { useApplication } from "../context/ApplicationContext";
import { useReviewReturn } from "../hooks/useReviewReturn";
import { saveDocumentAttachment } from "../lib/documentAttachment";
import { getDocumentUploadErrorMessage } from "../lib/documentStorage";
import { years } from "../lib/formOptions";

export default function Section2AddLanguageTest() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { returnPath } = useReviewReturn();
  const { data, ensureRemoteRecordId, addLanguageTest, updateLanguageTest } =
    useApplication();
  const existing = useMemo(
    () => data.languageTests.find((test) => test.id === id),
    [data.languageTests, id],
  );

  const [formData, setFormData] = useState({
    id: existing?.id ?? crypto.randomUUID(),
    type: existing?.type ?? "",
    name: existing?.name ?? "",
    year: existing?.year ?? "",
    document: existing?.document,
    documentName: existing?.documentName,
  });
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
    <div className="bg-gray-50 pb-12">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <SectionProgressHeader
          description="Add your English language test details."
          progress={66}
          sectionLabel="Section 2 of 3"
          title={existing ? "Edit English Language Test" : "Add English Language Test"}
        />

        {statusMessage ? (
          <div className="mt-4">
            <StatusMessage
              message={statusMessage.message}
              type={statusMessage.type}
              onDismiss={() => setStatusMessage(null)}
            />
          </div>
        ) : null}

        <FormSectionCard className="lg:p-8">
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
        </FormSectionCard>

        <FormActionBar
          previousLabel="Cancel"
          primaryLabel="Save & Continue"
          onPrevious={() => navigate(returnPath("/section2/qualifications"))}
          onPrimary={async () => {
            setStatusMessage(null);

            try {
              await saveRecord();
              navigate(returnPath("/section2/qualifications"));
            } catch (error) {
              setStatusMessage({
                message:
                  getDocumentUploadErrorMessage(error) ??
                  "We couldn't save this language test right now. Please try again.",
                type: "error",
              });
            }
          }}
        />
      </div>
    </div>
  );
}
