import { FileText } from "lucide-react";
import { DocumentUploadField } from "../../components/DocumentUploadField";
import type { TertiaryQualification } from "../../lib/applicationData";
import { Section2FormCard } from "./Section2FormCard";

interface TertiaryTranscriptUploadCardProps {
  formData: TertiaryQualification;
  hasTranscript: boolean;
  onClearTranscriptDocument: () => void;
  onClearTranscriptFile: () => void;
  onSelectTranscriptFile: (file: File | null) => void;
  selectedTranscriptFile: File | null;
}

export function TertiaryTranscriptUploadCard({
  formData,
  hasTranscript,
  onClearTranscriptDocument,
  onClearTranscriptFile,
  onSelectTranscriptFile,
  selectedTranscriptFile,
}: TertiaryTranscriptUploadCardProps) {
  return (
    <Section2FormCard
      description="Upload your academic transcript and we'll draft one qualification from it, then review program evidence."
      icon={<FileText className="mt-0.5 h-6 w-6 shrink-0 text-[var(--cta-secondary)]" />}
      title="Academic Transcript"
    >
      <div className="space-y-3">
        <DocumentUploadField
          attachedDescription="Your transcript is the academic record that shows the subjects you studied and the results you achieved."
          attachedStatus="Transcript attached"
          description="PDF, DOC, DOCX or TXT, up to 5 MB. One transcript drafts one qualification — we'll fill in the details below automatically."
          document={formData.transcriptDocument}
          documentName={formData.transcriptDocumentName}
          label="Upload transcript"
          missingStatus="Transcript required before submit"
          missingTone="warning"
          onClearDocument={onClearTranscriptDocument}
          onClearSelectedFile={onClearTranscriptFile}
          onFileSelect={onSelectTranscriptFile}
          required={!hasTranscript}
          selectedFile={selectedTranscriptFile}
          showStatusIcon
        />
        <p className="text-xs text-slate-500">
          Each transcript maps to one qualification. After you choose a file, we&apos;ll draft
          that qualification here for you to review, then save when ready.
        </p>
      </div>
    </Section2FormCard>
  );
}
