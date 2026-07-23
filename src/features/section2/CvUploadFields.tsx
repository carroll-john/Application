import { FileText } from "lucide-react";
import { DocumentUploadField } from "../../components/DocumentUploadField";
import type { UploadedDocument } from "../../lib/documentStorage";
import { Section2FormCard } from "./Section2FormCard";

interface CvUploadFieldsProps {
  currentDocument?: UploadedDocument;
  currentFileName?: string;
  hasDocument: boolean;
  onClearDocument: () => void;
  onClearSelectedFile: () => void;
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
}

export function CvUploadFields({
  currentDocument,
  currentFileName,
  hasDocument,
  onClearDocument,
  onClearSelectedFile,
  onFileSelect,
  selectedFile,
}: CvUploadFieldsProps) {
  return (
    <Section2FormCard
      description="Include your recent experience, skills, and achievements."
      icon={<FileText className="mt-0.5 h-6 w-6 shrink-0 text-[var(--cta-secondary)]" />}
      title="CV or Resume"
    >
      <DocumentUploadField
        attachedDescription="Your CV or resume is attached. You can view or remove it below."
        attachedStatus="CV attached"
        description="Include your recent experience, skills, and achievements."
        document={currentDocument}
        documentName={currentFileName}
        label="CV or Resume"
        missingStatus="Add your CV now, or come back to it later."
        onClearDocument={onClearDocument}
        onClearSelectedFile={onClearSelectedFile}
        onFileSelect={onFileSelect}
        required={!hasDocument}
        selectedFile={selectedFile}
      />

      <div className="content-block-compact rounded-lg border border-[var(--info-border)] bg-[var(--info-bg)] p-4">
        <p className="mb-2 text-sm font-medium text-[var(--info-text)]">Keep your CV:</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--info-text)]">
          <li>current and accurate</li>
          <li>focused on recent experience</li>
          <li>clearly named</li>
        </ul>
      </div>
    </Section2FormCard>
  );
}
