import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { FileUpload } from "./FileUpload";
import {
  viewLocalDocument,
  viewStoredDocument,
  type UploadedDocument,
} from "../lib/documentStorage";

type MissingTone = "info" | "warning";

interface DocumentUploadFieldProps {
  attachedDescription: string;
  attachedStatus: string;
  description: string;
  document?: UploadedDocument;
  documentName?: string;
  label: string;
  missingStatus: string;
  missingTone?: MissingTone;
  onClearDocument: () => void;
  onClearSelectedFile: () => void;
  onFileSelect: (file: File) => void;
  required?: boolean;
  selectedFile: File | null;
  showStatusIcon?: boolean;
}

const attachedClassName =
  "border-[var(--success-border)] bg-[linear-gradient(180deg,#ffffff_0%,#f7fcf9_100%)] shadow-[0_18px_40px_rgba(31,106,59,0.08)]";

const missingClassNames: Record<MissingTone, string> = {
  info: "border-[var(--info-border)] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbfd_100%)]",
  warning:
    "border-[var(--warning-border)] bg-[linear-gradient(180deg,#ffffff_0%,#fffaf0_100%)] shadow-[0_18px_40px_rgba(122,90,0,0.08)]",
};

const missingTextClassNames: Record<MissingTone, string> = {
  info: "text-[var(--info-text)]",
  warning: "text-[var(--warning-text)]",
};

export function DocumentUploadField({
  attachedDescription,
  attachedStatus,
  description,
  document,
  documentName,
  label,
  missingStatus,
  missingTone = "info",
  onClearDocument,
  onClearSelectedFile,
  onFileSelect,
  required,
  selectedFile,
  showStatusIcon = false,
}: DocumentUploadFieldProps) {
  const hasDocument = Boolean(selectedFile || document || documentName);
  const statusClassName = hasDocument
    ? "text-[var(--success-text)]"
    : missingTextClassNames[missingTone];
  const StatusIcon = hasDocument ? CheckCircle2 : AlertTriangle;

  return (
    <div>
      <FileUpload
        attachedDescription={attachedDescription}
        className={
          hasDocument ? attachedClassName : missingClassNames[missingTone]
        }
        description={description}
        fileName={selectedFile?.name || document?.name || documentName}
        fileSize={selectedFile?.size || document?.size}
        helperText=""
        label={label}
        onRemove={
          selectedFile || document
            ? () => {
                if (selectedFile) {
                  onClearSelectedFile();
                  return;
                }

                onClearDocument();
              }
            : undefined
        }
        onView={
          selectedFile
            ? () => {
                viewLocalDocument(selectedFile);
              }
            : document
              ? () => {
                  void viewStoredDocument(document);
                }
              : undefined
        }
        onFileSelect={onFileSelect}
        required={required}
      />
      <div className="mt-3 flex items-center gap-2">
        {showStatusIcon ? (
          <StatusIcon className={`h-4 w-4 ${statusClassName}`} />
        ) : null}
        <p className={`text-sm font-medium ${statusClassName}`}>
          {hasDocument ? attachedStatus : missingStatus}
        </p>
      </div>
    </div>
  );
}
