import { Eye, Paperclip, Trash2, Upload } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "./ui/button";
import { formatFileSize } from "../lib/documentStorage";
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
  const inputId = useId();
  const [error, setError] = useState<string | null>(null);
  const fileSizeLabel = formatFileSize(fileSize);
  const hasFile = Boolean(fileName);
  const defaultDescription = "PDF, DOC, DOCX, and TXT files are accepted. Max 5 MB.";
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
    <div
      className={cn(
        "rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-50 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]",
        className,
      )}
    >
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
      <div className="mt-4 space-y-3">
        {!hasFile ? (
          <>
            {pendingHelperText ? (
              <div className="flex items-center gap-2 rounded-2xl border border-[var(--info-border)] bg-[linear-gradient(135deg,#f4fbff_0%,var(--info-bg)_100%)] px-3 py-2 text-xs font-medium text-[var(--info-text)]">
                <Upload className="h-3.5 w-3.5 shrink-0" />
                <span>{pendingHelperText}</span>
              </div>
            ) : null}
            <div className="rounded-[26px] border-2 border-[#b7ccd8] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbfd_100%)] p-2 shadow-[0_14px_32px_rgba(15,23,42,0.08)] transition hover:border-[var(--cta-secondary)] focus-within:border-[var(--cta-secondary)] focus-within:ring-4 focus-within:ring-[rgba(8,78,116,0.12)]">
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

                  if (file.size > 5 * 1024 * 1024) {
                    setError("Choose a file smaller than 5 MB.");
                    event.target.value = "";
                    return;
                  }

                  setError(null);
                  onFileSelect(file);
                  event.target.value = "";
                }}
              />
              <div className="flex items-center gap-4 rounded-[22px] bg-white px-3 py-2">
                <label
                  className="inline-flex h-12 cursor-pointer items-center justify-center rounded-[22px] bg-[linear-gradient(135deg,#0c628f_0%,#084e74_58%,#063d5a_100%)] px-6 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(8,78,116,0.24)] transition hover:bg-[linear-gradient(135deg,#0a567d_0%,#063d5a_100%)]"
                  htmlFor={inputId}
                >
                  Choose file
                </label>
                <span className="min-w-0 text-base text-slate-500">
                  No file chosen
                </span>
              </div>
            </div>
          </>
        ) : null}
        {hasFile ? (
          <div className="flex flex-wrap items-center gap-2 rounded-[26px] border border-[var(--success-border)] bg-[linear-gradient(180deg,#ffffff_0%,#f7fcf9_100%)] px-4 py-3 text-sm text-[var(--success-text)] shadow-[0_14px_30px_rgba(31,106,59,0.08)]">
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
      </div>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
