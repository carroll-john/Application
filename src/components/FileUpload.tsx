import { Eye, Paperclip, Trash2, Upload } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "./ui/button";
import { formatFileSize } from "../lib/documentStorage";
import { DOCUMENT_UPLOAD_MAX_FILE_BYTES } from "../lib/documentUploadLimits";
import { cn } from "../lib/utils";

export function FileUpload({
  label,
  description,
  helperText,
  attachedDescription,
  className,
  fileName,
  fileSize,
  required = false,
  onView,
  onRemove,
  onFileSelect,
}: {
  label: string;
  description?: string;
  helperText?: string;
  attachedDescription?: string;
  className?: string;
  fileName?: string;
  fileSize?: number;
  required?: boolean;
  onView?: () => void;
  onRemove?: () => void;
  onFileSelect: (file: File) => void;
}) {
  const inputId = useId().replace(/:/g, "");
  const [error, setError] = useState<string | null>(null);
  const fileSizeLabel = formatFileSize(fileSize);
  const hasFile = Boolean(fileName);
  const maxFileSizeMb = DOCUMENT_UPLOAD_MAX_FILE_BYTES / (1024 * 1024);
  const maxFileSizeLabel = Number.isInteger(maxFileSizeMb)
    ? `${maxFileSizeMb} MB`
    : `${maxFileSizeMb.toFixed(1)} MB`;
  const defaultDescription = `PDF, DOC, DOCX, and TXT files are accepted. Max ${maxFileSizeLabel}.`;
  const pendingDescription =
    description === undefined ? defaultDescription : description;
  const attachedStateDescription =
    attachedDescription === undefined
      ? "Document attached. You can view or remove it below."
      : attachedDescription;
  const pendingHelperText =
    helperText === undefined
      ? "Upload a document now or come back later before you submit."
      : helperText;

  return (
    <div className={cn(className)}>
      <p className="text-sm font-semibold text-slate-800">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </p>
      {hasFile ? (
        attachedStateDescription ? (
          <p className="mt-1 text-xs text-slate-500">{attachedStateDescription}</p>
        ) : null
      ) : pendingDescription ? (
        <p className="mt-1 text-xs text-slate-500">{pendingDescription}</p>
      ) : null}
      {!hasFile ? (
        <div className="mt-3 space-y-3">
          {pendingHelperText ? (
            <div className="flex items-center gap-2 rounded-2xl border border-[var(--info-border)] bg-[linear-gradient(135deg,#f4fbff_0%,var(--info-bg)_100%)] px-3 py-2 text-xs font-medium text-[var(--info-text)]">
              <Upload className="h-3.5 w-3.5 shrink-0" />
              <span>{pendingHelperText}</span>
            </div>
          ) : null}
          <input
            id={inputId}
            accept=".pdf,.doc,.docx,.txt"
            className="sr-only"
            type="file"
            onChange={(event) => {
              const file = event.target.files?.[0];

              if (!file) {
                return;
              }

              const isAcceptedFileType =
                /\.(pdf|doc|docx|txt)$/i.test(file.name) ||
                [
                  "application/pdf",
                  "application/msword",
                  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                  "text/plain",
                ].includes(file.type);

              if (!isAcceptedFileType) {
                setError("Choose a PDF, DOC, DOCX, or TXT file.");
                event.target.value = "";
                return;
              }

              if (file.size > DOCUMENT_UPLOAD_MAX_FILE_BYTES) {
                setError(`Choose a file smaller than ${maxFileSizeLabel}.`);
                event.target.value = "";
                return;
              }

              setError(null);
              onFileSelect(file);
              event.target.value = "";
            }}
          />
          <div className="flex flex-wrap items-center gap-3">
            <label
              className="inline-flex h-11 cursor-pointer items-center justify-center rounded-full bg-[var(--cta-secondary)] px-5 text-sm font-semibold text-white shadow-[var(--shadow-cta-navy)] transition hover:bg-[var(--cta-secondary-hover)]"
              htmlFor={inputId}
            >
              Choose file
            </label>
            <span className="text-sm text-slate-500">No file chosen</span>
          </div>
        </div>
      ) : null}
      {hasFile ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--success-border)] bg-[linear-gradient(180deg,#ffffff_0%,#f7fcf9_100%)] px-4 py-3 text-sm text-[var(--success-text)]">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Paperclip className="h-4 w-4 shrink-0" />
            <span className="truncate font-medium">{fileName}</span>
          </div>
          {fileSizeLabel ? (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
              {fileSizeLabel}
            </span>
          ) : null}
          <div className="flex w-full flex-wrap gap-2 pt-2 sm:justify-end">
            {onView ? (
              <Button
                type="button"
                className="h-9 rounded-full px-4 text-xs"
                variant="soft"
                onClick={onView}
              >
                <Eye className="h-3.5 w-3.5" />
                View
              </Button>
            ) : null}
            {onRemove ? (
              <Button
                type="button"
                className="h-9 rounded-full border border-[var(--error-border)] bg-white px-4 text-xs text-[var(--error-text)] hover:bg-[var(--error-bg)]"
                variant="neutralOutline"
                onClick={onRemove}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
