import { Award, FileText, Shield } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FileUpload } from "../components/FileUpload";
import { FormActionBar } from "../components/FormActionBar";
import { FormSectionCard } from "../components/FormSectionCard";
import { SectionProgressHeader } from "../components/SectionProgressHeader";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { NativeSelect } from "../components/ui/native-select";
import { useApplication } from "../context/ApplicationContext";
import { useReviewReturn } from "../hooks/useReviewReturn";
import {
  deleteStoredDocument,
  replaceStoredDocument,
  viewLocalDocument,
  viewStoredDocument,
} from "../lib/documentStorage";

export default function Section2AddAccreditation() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { returnPath } = useReviewReturn();
  const {
    data,
    ensureRemoteRecordId,
    addProfessionalAccreditation,
    updateProfessionalAccreditation,
  } = useApplication();
  const existing = useMemo(
    () =>
      data.professionalAccreditations.find(
        (accreditation) => accreditation.id === id,
      ),
    [data.professionalAccreditations, id],
  );

  const [formData, setFormData] = useState({
    id: existing?.id ?? crypto.randomUUID(),
    name: existing?.name ?? "",
    status: existing?.status ?? "",
    document: existing?.document,
    documentName: existing?.documentName,
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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
          kind: "accreditation_document",
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
            existing
              ? "Edit Professional Accreditation"
              : "Add Professional Accreditation"
          }
        />

        <div className="space-y-6">
          <FormSectionCard
            description="Record the qualification, registration, or membership."
            icon={<Award className="mt-0.5 h-6 w-6 shrink-0 text-[#084E74]" />}
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
            icon={<Shield className="mt-0.5 h-6 w-6 shrink-0 text-[#084E74]" />}
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
            icon={<FileText className="mt-0.5 h-6 w-6 shrink-0 text-[#084E74]" />}
            title="Supporting Documents"
          >
            <FileUpload
              attachedDescription="Your accreditation document is attached. You can view or remove it below."
              className={
                hasDocument
                  ? "border-[var(--success-border)] bg-[linear-gradient(180deg,#ffffff_0%,#f7fcf9_100%)] shadow-[0_18px_40px_rgba(31,106,59,0.08)]"
                  : "border-[var(--info-border)] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbfd_100%)]"
              }
              description="Upload the certificate, licence, or membership evidence."
              fileName={selectedFile?.name || formData.document?.name || formData.documentName}
              fileSize={selectedFile?.size || formData.document?.size}
              helperText=""
              label="Accreditation Document"
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
            <div className="mt-3 flex items-center gap-2">
              <p
                className={`text-sm font-medium ${
                  hasDocument
                    ? "text-[var(--success-text)]"
                    : "text-[var(--info-text)]"
                }`}
              >
                {hasDocument
                  ? "Document attached"
                  : "Add the document now, or come back to it later if needed."}
              </p>
            </div>
          </FormSectionCard>
        </div>

        <FormActionBar
          previousLabel="Cancel"
          primaryLabel="Save & Continue"
          onPrevious={() => navigate(returnPath("/section2/qualifications"))}
          onPrimary={async () => {
            await saveRecord();
            navigate(returnPath("/section2/qualifications"));
          }}
        />
      </div>
    </div>
  );
}
