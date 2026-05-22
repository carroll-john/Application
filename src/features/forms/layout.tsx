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
  children,
}: ApplicationShellProps) {
  return (
    <div className="bg-[#f7f7f4] pb-12">
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

        <FormActionBar
          onPrevious={onPrevious}
          onPrimary={onContinue}
          onSecondary={onSaveAndExit}
          previousLabel={previousLabel}
          primaryLabel={continueLabel}
          secondaryLabel={onSaveAndExit ? "Save & Exit" : undefined}
        />
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

interface SectionProgressHeaderProps {
  description?: string;
  progress: number;
  sectionLabel: string;
  title: string;
}

export function SectionProgressHeader({
  description,
  progress,
  sectionLabel,
  title,
}: SectionProgressHeaderProps) {
  return (
    <>
      <div className="mb-6 sm:mb-8">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-700 sm:text-sm">{sectionLabel}</span>
          <span className="text-xs font-medium text-gray-700 sm:text-sm">{progress}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-gray-200">
          <div
            className="h-2 rounded-full bg-[var(--cta-secondary)] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="mb-6 sm:mb-8">
        <h1 className="mb-2 text-2xl font-bold text-gray-900 sm:text-3xl">{title}</h1>
        {description ? <p className="text-sm text-gray-600 sm:text-base">{description}</p> : null}
      </div>
    </>
  );
}
