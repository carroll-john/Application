import { Edit, Paperclip } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../../components/ui/button";

export function ReviewCard({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 border-l-4 border-l-[var(--cta-secondary)] bg-white p-5 shadow-sm sm:p-6">
      <div
        className={
          onEdit
            ? "mb-5 flex items-center justify-between gap-3"
            : "mb-5"
        }
      >
        <h3 className="text-base font-bold text-gray-900 sm:text-lg">{title}</h3>
        {onEdit ? (
          <Button
            className="shrink-0 rounded-lg text-sm font-medium shadow-none"
            onClick={onEdit}
            size="sm"
            variant="outline"
          >
            <Edit className="h-4 w-4" />
            Edit
          </Button>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function ReviewDocumentRow({
  fileName,
  label,
  onEdit,
}: {
  fileName: string;
  label?: string;
  onEdit: () => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <Paperclip className="h-4 w-4 shrink-0 text-green-600" />
          <span className="min-w-0 break-all text-sm font-medium text-green-600">
            {label ? `${label}: ` : ""}
            {fileName}
          </span>
        </div>
        <Button
          className="shrink-0 rounded-lg"
          onClick={onEdit}
          size="sm"
          variant="outline"
        >
          <Edit className="h-3 w-3" />
          Edit
        </Button>
      </div>
    </div>
  );
}

export interface ReviewListItem {
  attachments?: Array<{ fileName: string; label?: string }>;
  detail?: ReactNode;
  editPath: string;
  fallbackTitle: string;
  fields: Array<[string, string]>;
  id: string;
  title: string;
}

export function ReviewList({
  items,
  onEdit,
}: {
  items: ReviewListItem[];
  onEdit: (path: string) => void;
}) {
  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={item.id}
          className="rounded-lg border border-gray-200 bg-gray-50 p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="font-medium text-gray-900">
              <span className="mr-2 rounded bg-[var(--cta-secondary)] px-2 py-0.5 text-xs text-white">
                #{index + 1}
              </span>
              {item.title || item.fallbackTitle}
            </p>
            <Button
              className="ml-2 rounded-lg"
              onClick={() => onEdit(item.editPath)}
              size="sm"
              variant="outline"
            >
              <Edit className="h-3 w-3" />
              Edit
            </Button>
          </div>
          <ReviewGrid
            className="mt-3 grid gap-3 text-sm sm:grid-cols-2"
            items={item.fields}
          />
          {item.detail}
          <ReviewAttachments attachments={item.attachments ?? []} />
        </div>
      ))}
    </div>
  );
}

export function ReviewGrid({
  className = "grid gap-4 text-sm sm:grid-cols-2",
  items,
}: {
  className?: string;
  items: Array<[string, string]>;
}) {
  return (
    <div className={className}>
      {items.map(([label, value]) => (
        <ReviewField key={`${label}-${value}`} label={label} value={value} />
      ))}
    </div>
  );
}

function ReviewField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-gray-600">{label}</p>
      <p className={`font-medium ${value ? "text-gray-900" : "text-gray-500"}`}>
        {value || "Not provided"}
      </p>
    </div>
  );
}

export function ReviewAttachments({
  attachments,
}: {
  attachments: Array<{ fileName: string; label?: string }>;
}) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 space-y-2 border-t border-gray-200 pt-3">
      {attachments.map((attachment) => (
        <div
          key={`${attachment.label ?? "attachment"}-${attachment.fileName}`}
          className="flex min-w-0 items-start gap-2"
        >
          <Paperclip className="h-4 w-4 text-green-600" />
          <span className="min-w-0 break-all text-sm font-medium text-green-600">
            {attachment.label ? `${attachment.label}: ` : ""}
            {attachment.fileName}
          </span>
        </div>
      ))}
    </div>
  );
}
