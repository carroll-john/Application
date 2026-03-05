import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FileUpload } from "../components/FileUpload";
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
import {
  deleteStoredDocument,
  getDocumentUploadErrorMessage,
  replaceStoredDocument,
  viewLocalDocument,
  viewStoredDocument,
} from "../lib/documentStorage";
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
  const hasDocument =
    Boolean(selectedFile) ||
    Boolean(formData.document) ||
    Boolean(formData.documentName);

  const saveRecord = async () => {
    let document = formData.document;
    const applicationId = await ensureRemoteRecordId();

    if (selectedFile) {
      document = await replaceStoredDocument(
        selectedFile,
        formData.document ?? originalDocument,
        {
          applicationId,
          kind: "language_test_document",
        },
      );
    } else if (!formData.document && originalDocument) {
      await deleteStoredDocument(originalDocument);
      document = undefined;
    }

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

            <FileUpload
              attachedDescription="Your test results document is attached. You can view or remove it below."
              className={
                hasDocument
                  ? "border-[var(--success-border)] bg-[linear-gradient(180deg,#ffffff_0%,#f7fcf9_100%)] shadow-[0_18px_40px_rgba(31,106,59,0.08)]"
                  : "border-[var(--info-border)] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbfd_100%)]"
              }
              description="Upload the score report or official result."
              fileName={selectedFile?.name || formData.document?.name || formData.documentName}
              fileSize={selectedFile?.size || formData.document?.size}
              helperText=""
              label="Test Results Document"
              onRemove={
                selectedFile || formData.document
                  ? () => {
                      if (selectedFile) {
                        setSelectedFile(null);
                        return;
                      }

                      setFormData((previous) => ({
                        ...previous,
                        document: undefined,
                        documentName: undefined,
                      }));
                    }
                  : undefined
              }
              onView={
                selectedFile
                  ? () => {
                      viewLocalDocument(selectedFile);
                    }
                  : formData.document
                    ? () => {
                        void viewStoredDocument(formData.document);
                      }
                    : undefined
              }
              onFileSelect={(file) => setSelectedFile(file)}
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
                  ? "Results document attached"
                  : "Add your score report now, or come back to it later."}
              </p>
            </div>

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
