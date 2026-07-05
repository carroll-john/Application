import type { ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Edit2,
  Paperclip,
  Plus,
  Trash2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { StatusPill } from "../../components/StatusPill";
import { Button } from "../../components/ui/button";
import type { SectionStatus } from "./types";

interface QualificationsSectionCardProps<T> {
  title: string;
  description: string;
  icon: ReactNode;
  status: SectionStatus;
  items: T[];
  renderItem: (item: T) => ReactNode;
  emptyMessage: string;
  actionRoute: string;
  actionText?: string;
  onSkip: () => void;
  showAddAction?: boolean;
}

export function QualificationsSectionCard<T>({
  title,
  description,
  icon,
  status,
  items,
  renderItem,
  emptyMessage,
  actionRoute,
  actionText = "Add",
  onSkip,
  showAddAction = true,
}: QualificationsSectionCardProps<T>) {
  const navigate = useNavigate();
  const isLocked = status === "locked";
  const isActive = status === "active";
  const isCompleted = status === "completed";
  const isSkipped = status === "skipped";
  const needsAttention = status === "needsAttention";

  function getSectionClasses() {
    switch (status) {
      case "locked":
        return "bg-gray-100 border-gray-300 opacity-60";
      case "active":
        return "bg-[var(--info-bg)] border-[var(--cta-secondary)] border-2 shadow-md";
      case "completed":
        return "bg-[var(--success-bg)] border-[var(--success-border)]";
      case "needsAttention":
        return "bg-[var(--warning-bg)] border-[var(--warning-border)]";
      case "skipped":
        return "bg-gray-50 border-gray-200";
      default:
        return "bg-white border-gray-200";
    }
  }

  return (
    <div
      className={`rounded-lg border p-4 shadow-sm transition-all sm:p-6 ${getSectionClasses()}`}
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative">
            {icon}
            {isCompleted ? (
              <CheckCircle2 className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-white text-green-600" />
            ) : null}
            {needsAttention ? (
              <AlertTriangle className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-white text-[var(--warning-text)]" />
            ) : null}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-gray-900 sm:text-lg">{title}</h3>
              {isCompleted ? (
                <StatusPill className="px-2 py-0.5 text-xs" tone="success">
                  Completed
                </StatusPill>
              ) : null}
              {needsAttention ? (
                <StatusPill className="px-2 py-0.5 text-xs" tone="warning">
                  Incomplete
                </StatusPill>
              ) : null}
              {isSkipped ? (
                <StatusPill className="px-2 py-0.5 text-xs" tone="neutral">
                  Skipped
                </StatusPill>
              ) : null}
              {isActive ? (
                <StatusPill className="px-2 py-0.5 text-xs" tone="info">
                  Current
                </StatusPill>
              ) : null}
            </div>
            <p className="text-xs text-gray-600 sm:text-sm">{description}</p>
          </div>
        </div>

        {isLocked ? (
          <div className="text-xs italic text-gray-500 sm:text-sm">
            Complete previous sections to unlock
          </div>
        ) : showAddAction ? (
          <div className="flex gap-2">
            <Button
              className={`h-10 rounded-lg text-sm font-medium shadow-none ${
                isActive && items.length === 0 ? "flex-1 sm:flex-initial" : "w-full sm:w-auto"
              }`}
              disabled={isLocked}
              onClick={() => navigate(actionRoute)}
              variant="soft"
            >
              <Plus className="mr-2 h-4 w-4" />
              {actionText}
            </Button>
            {isActive && items.length === 0 ? (
              <Button
                className="h-10 flex-1 rounded-lg text-sm font-medium shadow-none sm:flex-initial"
                onClick={onSkip}
                variant="outline"
              >
                Skip
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {isLocked ? null : items.length > 0 ? (
        <div className="mt-4 space-y-2">{items.map((item) => renderItem(item))}</div>
      ) : isSkipped ? (
        <p className="mt-2 text-xs italic text-gray-500 sm:text-sm">
          This section was skipped. You can still add information by clicking the Add button
          above.
        </p>
      ) : (
        <p className="mt-2 text-xs text-gray-500 sm:text-sm">{emptyMessage}</p>
      )}
    </div>
  );
}

interface QualificationsListItemProps {
  title: string;
  subtitle: string;
  attachment?: string;
  attachments?: string[];
  onEdit: () => void;
  onDelete: () => void;
}

export function QualificationsListItem({
  title,
  subtitle,
  attachment,
  attachments,
  onEdit,
  onDelete,
}: QualificationsListItemProps) {
  const attachmentList = attachments ?? (attachment ? [attachment] : []);

  return (
    <div className="rounded border border-gray-200 bg-white p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 sm:text-base">{title}</p>
          <p className="text-xs text-gray-600 sm:text-sm">{subtitle}</p>
          {attachmentList.length
            ? attachmentList.map((attachmentName, index) => (
                <QualificationsAttachment
                  key={`${attachmentName}-${index}`}
                  fileName={attachmentName}
                />
              ))
            : null}
        </div>
        <div className="flex items-center gap-2">
          <Button
            className="h-9 flex-1 rounded-lg border-slate-300 px-3 py-2 text-xs text-slate-700 shadow-none hover:bg-slate-50 sm:flex-initial sm:text-sm"
            onClick={onEdit}
            variant="outline"
          >
            <Edit2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
          <Button
            className="h-9 flex-1 rounded-lg border-red-200 px-3 py-2 text-xs text-red-600 shadow-none hover:bg-red-50 sm:flex-initial sm:text-sm"
            onClick={onDelete}
            variant="outline"
          >
            <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function QualificationsAttachment({ fileName }: { fileName: string }) {
  return (
    <div className="mt-2 flex min-w-0 items-start gap-1.5">
      <Paperclip className="h-3 w-3 shrink-0 text-green-600 sm:h-3.5 sm:w-3.5" />
      <span className="min-w-0 break-all text-xs font-medium text-green-600">{fileName}</span>
    </div>
  );
}
