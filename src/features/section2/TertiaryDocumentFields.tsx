import { FileText } from "lucide-react";
import { DocumentUploadField } from "../../components/DocumentUploadField";
import type { TertiaryQualification } from "../../lib/applicationData";
import { Section2FormCard } from "./Section2FormCard";

interface TertiaryDocumentFieldsProps {
  formData: TertiaryQualification;
  hasCertificate: boolean;
  hasTranscript: boolean;
  onClearCertificateDocument: () => void;
  onClearCertificateFile: () => void;
  onClearTranscriptDocument: () => void;
  onClearTranscriptFile: () => void;
  onSelectCertificateFile: (file: File | null) => void;
  onSelectTranscriptFile: (file: File | null) => void;
  selectedCertificateFile: File | null;
  selectedTranscriptFile: File | null;
}

export function TertiaryDocumentFields({
  formData,
  hasCertificate,
  hasTranscript,
  onClearCertificateDocument,
  onClearCertificateFile,
  onClearTranscriptDocument,
  onClearTranscriptFile,
  onSelectCertificateFile,
  onSelectTranscriptFile,
  selectedCertificateFile,
  selectedTranscriptFile,
}: TertiaryDocumentFieldsProps) {
  return (
    <Section2FormCard
      description="Attach supporting documents now or later before submit. PDF, DOC, DOCX or TXT, up to 5 MB."
      icon={<FileText className="mt-0.5 h-6 w-6 shrink-0 text-[var(--cta-secondary)]" />}
      title="Supporting Documents"
    >
      <div className="space-y-5">
        <DocumentUploadField
          attachedDescription="Your transcript is the academic record that shows the subjects you studied and the results you achieved."
          attachedStatus="Transcript attached"
          description="Your transcript is the academic record that shows the subjects you studied and the results you achieved."
          document={formData.transcriptDocument}
          documentName={formData.transcriptDocumentName}
          label="Academic Transcript"
          missingStatus="Transcript required before submit"
          missingTone="warning"
          onClearDocument={onClearTranscriptDocument}
          onClearSelectedFile={onClearTranscriptFile}
          onFileSelect={onSelectTranscriptFile}
          required={!hasTranscript}
          selectedFile={selectedTranscriptFile}
          showStatusIcon
        />

        {formData.completed ? (
          <div className="animate-in fade-in duration-300">
            <DocumentUploadField
              attachedDescription="Your certificate of completion confirms that you finished and were awarded this qualification."
              attachedStatus="Certificate of completion attached"
              description="Your certificate of completion confirms that you finished and were awarded this qualification."
              document={formData.certificateDocument}
              documentName={formData.certificateDocumentName}
              label="Certificate of Completion"
              missingStatus="Certificate required before submit"
              missingTone="warning"
              onClearDocument={onClearCertificateDocument}
              onClearSelectedFile={onClearCertificateFile}
              onFileSelect={onSelectCertificateFile}
              required={!hasCertificate}
              selectedFile={selectedCertificateFile}
              showStatusIcon
            />
          </div>
        ) : null}
      </div>
    </Section2FormCard>
  );
}
