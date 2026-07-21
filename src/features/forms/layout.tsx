import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { FormActionBar } from "./FormActionBar";

interface ApplicationShellProps {
  sectionLabel: string;
  progress: number;
  title: string;
  description: string;
  onPrevious: () => void;
  onContinue: () => void;
  onSaveAndExit?: () => void;
  previousLabel?: string;
  continueLabel?: string;
  continueDisabled?: boolean;
  previousDisabled?: boolean;
  secondaryDisabled?: boolean;
  secondaryLabel?: string;
  showActionBar?: boolean;
  className?: string;
  children: ReactNode;
}

export function ApplicationShell({
  sectionLabel,
  progress,
  title,
  description,
  onPrevious,
  onContinue,
  onSaveAndExit,
  previousLabel = "Previous",
  continueLabel = "Continue",
  continueDisabled = false,
  previousDisabled = false,
  secondaryDisabled = false,
  secondaryLabel,
  showActionBar = true,
  className,
  children,
}: ApplicationShellProps) {
  return (
    <div className={cn("bg-[var(--background)] pb-12", className)}>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-6 sm:mb-8">
          <div className="mb-2 flex items-center justify-between text-sm font-medium text-slate-700">
            <span>{sectionLabel}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-200">
            <div
              className="h-2 rounded-full bg-[var(--cta-secondary)] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{title}</h1>
        <p className="mb-6 mt-2 max-w-2xl text-sm text-slate-600 sm:mb-8 sm:text-base">
          {description}
        </p>

        {children}

        {showActionBar ? (
          <FormActionBar
            onPrevious={onPrevious}
            onPrimary={onContinue}
            onSecondary={onSaveAndExit}
            previousDisabled={previousDisabled}
            primaryDisabled={continueDisabled}
            secondaryDisabled={secondaryDisabled}
            previousLabel={previousLabel}
            primaryLabel={continueLabel}
            secondaryLabel={secondaryLabel ?? (onSaveAndExit ? "Save & Exit" : undefined)}
          />
        ) : null}
      </div>
    </div>
  );
}

interface FormSectionCardProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  description?: string;
  icon?: ReactNode;
  title?: string;
}

export function FormSectionCard({
  children,
  className,
  contentClassName,
  description,
  icon,
  title,
}: FormSectionCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-[var(--border)] bg-white p-4 shadow-sm sm:p-6",
        className,
      )}
    >
      {title || description || icon ? (
        <div className="mb-5 flex items-start gap-3">
          {icon}
          <div className="flex-1">
            {title ? (
              <h2 className="text-base font-bold text-gray-900 sm:text-lg">{title}</h2>
            ) : null}
            {description ? (
              <p className="mt-1 text-xs text-gray-600 sm:text-sm">{description}</p>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className={contentClassName}>{children}</div>
    </div>
  );
}
