import { AlertTriangle } from "lucide-react";

export function ReviewDeclaration() {
  return (
    <div className="rounded-lg border border-[var(--info-border)] bg-[var(--info-bg)] p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--info-text)]" />
        <div>
          <p className="mb-1 text-sm font-medium text-[var(--info-text)]">
            Declaration
          </p>
          <p className="text-xs leading-relaxed text-[var(--info-text)]">
            By submitting this application, you declare that all information
            provided is true and accurate. You agree to the terms and conditions
            and understand that providing false information may result in your
            application being rejected.
          </p>
        </div>
      </div>
    </div>
  );
}
