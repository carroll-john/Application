import { Award, FileText, Shield } from "lucide-react";
import { useState } from "react";
import { DocumentUploadField } from "../components/DocumentUploadField";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { NativeSelect } from "../components/ui/native-select";
import { useApplication } from "../context/ApplicationContext";
import { Section2FormCard, Section2RecordPage } from "../features/section2";
import { useEditableRecord } from "../hooks/useEditableRecord";
import { useSection2RecordSave } from "../hooks/useSection2RecordSave";
import { saveSection2DocumentRecord } from "../features/section2/section2DocumentSave";

export default function Section2AddAccreditation() {
  const {
    data,
    ensureApplicationRow,
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
  const originalDocument = existing?.document;

  const saveRecord = async () => {
    const { document, documentName } = await saveSection2DocumentRecord({
      currentDocument: formData.document,
      ensureApplicationRow,
      kind: "accreditation_document",
      originalDocument,
      selectedFile,
    });

    const nextRecord = {
      ...formData,
      document,
      documentName,
    };

    if (existing) {
      updateProfessionalAccreditation(existing.id, nextRecord);
    } else {
      addProfessionalAccreditation(nextRecord);
    }
  };

  const { statusMessage, clearStatusMessage, handleSaveAndReturn } =
    useSection2RecordSave({
      errorFallbackMessage:
        "We couldn't save this accreditation right now. Please try again.",
      saveRecord,
    });

  return (
    <Section2RecordPage
      addTitle="Add Professional Accreditation"
      description="Add certifications, licences, and professional memberships."
      editTitle="Edit Professional Accreditation"
      isEditing={isEditing}
      navigateAfterSave={false}
      statusMessage={statusMessage}
      onDismissStatus={clearStatusMessage}
      onSave={handleSaveAndReturn}
    >
      <div className="space-y-6">
        <Section2FormCard
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
        </Section2FormCard>

        <Section2FormCard
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
        </Section2FormCard>

        <Section2FormCard
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
        </Section2FormCard>
      </div>
    </Section2RecordPage>
  );
}
