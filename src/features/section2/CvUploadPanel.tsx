import { FileUpload } from "../../components/FileUpload";
import type { UploadedDocument } from "../../lib/documentStorage";

interface CvUploadPanelProps {
  currentDocument?: UploadedDocument;
  currentFileName?: string;
  hasDocument: boolean;
  onClearDocument: () => void;
  onClearSelectedFile: () => void;
  onFileSelect: (file: File) => void;
  onViewDocument: () => void;
  onViewSelectedFile: () => void;
  selectedFile: File | null;
}

export function CvUploadPanel({
  currentDocument,
  currentFileName,
  hasDocument,
  onClearDocument,
  onClearSelectedFile,
  onFileSelect,
  onViewDocument,
  onViewSelectedFile,
  selectedFile,
}: CvUploadPanelProps) {
  return (
    <>
      <FileUpload
        attachedDescription="Your CV or resume is attached. You can view or remove it below."
        className={
          hasDocument
            ? "border-[var(--success-border)] bg-[linear-gradient(180deg,#ffffff_0%,#f7fcf9_100%)] shadow-[0_18px_40px_rgba(31,106,59,0.08)]"
            : "border-[var(--info-border)] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbfd_100%)]"
        }
        description="Include your recent experience, skills, and achievements."
        fileName={selectedFile?.name || currentDocument?.name || currentFileName}
        fileSize={selectedFile?.size || currentDocument?.size}
        helperText=""
        label="CV or Resume"
        required
        onRemove={
          selectedFile || currentDocument
            ? () => {
                if (selectedFile) {
                  onClearSelectedFile();
                  return;
                }

                onClearDocument();
              }
            : undefined
        }
        onView={selectedFile ? onViewSelectedFile : currentDocument ? onViewDocument : undefined}
        onFileSelect={onFileSelect}
      />
      <div className="flex items-center gap-2">
        <p
          className={`text-sm font-medium ${
            hasDocument ? "text-[var(--success-text)]" : "text-[var(--info-text)]"
          }`}
        >
          {hasDocument ? "CV attached" : "Add your CV now, or come back to it later."}
        </p>
      </div>

      <div className="rounded-lg border border-[var(--info-border)] bg-[var(--info-bg)] p-4">
        <p className="mb-2 text-sm font-medium text-[var(--info-text)]">Keep your CV:</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--info-text)]">
          <li>current and accurate</li>
          <li>focused on recent experience</li>
          <li>clearly named</li>
        </ul>
      </div>
    </>
  );
}
