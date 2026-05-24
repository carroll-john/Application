import { FileText } from "lucide-react";
import { DocumentUploadField } from "../../components/DocumentUploadField";
import type { TertiaryQualification } from "../../lib/applicationData";
import { Section2FormCard } from "./Section2FormCard";

interface TertiaryDocumentFieldsProps {
  formData: TertiaryQualification;
  onClearCertificateDocument: () => void;
  onClearCertificateFile: () => void;
  onSelectCertificateFile: (file: File | null) => void;
  selectedCertificateFile: File | null;
}

export function TertiaryDocumentFields({
  formData,
  onClearCertificateDocument,
  onClearCertificateFile,
  onSelectCertificateFile,
  selectedCertificateFile,
}: TertiaryDocumentFieldsProps) {
  if (!formData.completed) {
    return null;
  }

  return (
    <Section2FormCard
      description="Optional. PDF, DOC, DOCX or TXT, up to 5 MB."
      icon={<FileText className="mt-0.5 h-6 w-6 shrink-0 text-[var(--cta-secondary)]" />}
      title="Certificate of Completion (optional)"
    >
      <DocumentUploadField
        attachedDescription="Your certificate of completion confirms that you finished and were awarded this qualification."
        attachedStatus="Certificate of completion attached"
        description="Attach your certificate if you have one. You can add it later or skip it entirely."
        document={formData.certificateDocument}
        documentName={formData.certificateDocumentName}
        label="Certificate of Completion"
        missingStatus="Optional — attach if available"
        missingTone="info"
        onClearDocument={onClearCertificateDocument}
        onClearSelectedFile={onClearCertificateFile}
        onFileSelect={onSelectCertificateFile}
        selectedFile={selectedCertificateFile}
        showStatusIcon
      />
    </Section2FormCard>
  );
}
