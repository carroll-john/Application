import type { ReactNode } from "react";
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
              className="h-2 rounded-full bg-[#084E74] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
          {title}
        </h1>
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
