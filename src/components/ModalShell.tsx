import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/utils";

interface ModalShellProps {
  bodyClassName?: string;
  children: ReactNode;
  footer?: ReactNode;
  header?: ReactNode;
  maxWidthClassName?: string;
  onClose?: () => void;
  panelClassName?: string;
  title?: string;
}

export function ModalShell({
  bodyClassName,
  children,
  footer,
  header,
  maxWidthClassName = "max-w-lg",
  onClose,
  panelClassName,
  title,
}: ModalShellProps) {
  const defaultHeader =
    title && onClose ? (
      <div className="flex items-start justify-between gap-4 p-6 sm:p-8 sm:pb-0">
        <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
        <button
          type="button"
          className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    ) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-4 sm:items-center">
      <div
        className={cn(
          "my-auto w-full overflow-visible rounded-[32px] bg-white shadow-2xl",
          maxWidthClassName,
          panelClassName,
        )}
      >
        {header ?? defaultHeader}
        <div
          className={cn(
            header || defaultHeader ? "px-6 pb-6 pt-4 sm:px-8 sm:pb-8" : "p-6 sm:p-8",
            bodyClassName,
          )}
        >
          {children}
        </div>
        {footer}
      </div>
    </div>
  );
}
