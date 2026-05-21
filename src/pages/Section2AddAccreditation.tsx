import { Award, FileText, Shield } from "lucide-react";
import { useState } from "react";
import { DocumentUploadField } from "../components/DocumentUploadField";
import { FormActionBar } from "../components/FormActionBar";
import { FormSectionCard } from "../components/FormSectionCard";
import { SectionProgressHeader } from "../components/SectionProgressHeader";
import { StatusMessage } from "../components/StatusMessage";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { NativeSelect } from "../components/ui/native-select";
import { useApplication } from "../context/ApplicationContext";
import { useEditableRecord } from "../hooks/useEditableRecord";
import { useSection2Navigation } from "../hooks/useSection2Navigation";
import { saveDocumentAttachment } from "../lib/documentAttachment";
import { getDocumentUploadErrorMessage } from "../lib/documentStorage";

export default function Section2AddAccreditation() {
  const { returnToQualifications } = useSection2Navigation();
  const {
    data,
    ensureRemoteRecordId,
    addProfessionalAccreditation,
    updateProfessionalAccreditation,
  } = useApplication();
  const { existing, isEditing, initialRecord } = useEditableRecord(
    data.professionalAccreditations,
    () => ({
      id: crypto.randomUUID(),
      name: "",
      status: "",
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
      kind: "accreditation_document",
      originalDocument,
      selectedFile,
    });

    const nextRecord = {
      ...formData,
      document,
      documentName: document?.name,
    };

    if (existing) {
      updateProfessionalAccreditation(existing.id, nextRecord);
    } else {
      addProfessionalAccreditation(nextRecord);
    }
  };

  return (
    <div className="bg-gray-50 pb-12">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <SectionProgressHeader
          description="Add certifications, licences, and professional memberships."
          progress={66}
          sectionLabel="Section 2 of 3"
          title={
            isEditing
              ? "Edit Professional Accreditation"
              : "Add Professional Accreditation"
          }
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

        <div className="space-y-6">
          <FormSectionCard
            description="Record the qualification, registration, or membership."
            icon={<Award className="mt-0.5 h-6 w-6 shrink-0 text-[var(--cta-secondary)]" />}
            title="Accreditation Details"
          >
            <Label>Accreditation Name <span className="text-red-500">*</span></Label>
            <Input
              className="h-12 text-base"
              placeholder="e.g. CPA Australia, Registered Nurse"
              value={formData.name}
              onChange={(event) =>
                setFormData((previous) => ({
                  ...previous,
                  name: event.target.value,
                }))
              }
            />
            <p className="mt-2 text-xs text-gray-500">
              Use the official name shown on the document.
            </p>
          </FormSectionCard>

          <FormSectionCard
            description="Tell us whether this accreditation is current."
            icon={<Shield className="mt-0.5 h-6 w-6 shrink-0 text-[var(--cta-secondary)]" />}
            title="Current Status"
          >
            <Label>Status <span className="text-red-500">*</span></Label>
            <NativeSelect
              value={formData.status}
              onChange={(event) =>
                setFormData((previous) => ({
                  ...previous,
                  status: event.target.value,
                }))
              }
            >
              <option value="">Select status</option>
              <option value="Active">Active</option>
              <option value="Pending">Pending</option>
              <option value="Expired">Expired</option>
              <option value="In Progress">In Progress</option>
            </NativeSelect>
          </FormSectionCard>

          <FormSectionCard
            description="Attach the supporting document now or later before submit. PDF, DOC, DOCX or TXT, up to 5 MB."
            icon={<FileText className="mt-0.5 h-6 w-6 shrink-0 text-[var(--cta-secondary)]" />}
            title="Supporting Documents"
          >
            <DocumentUploadField
              attachedDescription="Your accreditation document is attached. You can view or remove it below."
              attachedStatus="Document attached"
              description="Upload the certificate, licence, or membership evidence."
              document={formData.document}
              documentName={formData.documentName}
              label="Accreditation Document"
              missingStatus="Add the document now, or come back to it later if needed."
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
          </FormSectionCard>
        </div>

        <FormActionBar
          previousLabel="Cancel"
          primaryLabel="Save & Continue"
          onPrevious={returnToQualifications}
          onPrimary={async () => {
            setStatusMessage(null);

            try {
              await saveRecord();
              returnToQualifications();
            } catch (error) {
              setStatusMessage({
                message:
                  getDocumentUploadErrorMessage(error) ??
                  "We couldn't save this accreditation right now. Please try again.",
                type: "error",
              });
            }
          }}
        />
      </div>
    </div>
  );
}
