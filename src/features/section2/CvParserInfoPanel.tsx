interface CvParserInfoPanelProps {
  hasExistingEmployment: boolean;
}

export function CvParserInfoPanel({ hasExistingEmployment }: CvParserInfoPanelProps) {
  return (
    <div className="rounded-lg border border-[var(--info-border)] bg-white p-4">
      <p className="text-sm font-medium text-slate-900">AI employment draft</p>
      <p className="mt-2 text-sm text-slate-600">
        {hasExistingEmployment
          ? "Employment history already exists on this application, so saving a new CV will not overwrite those rows automatically."
          : "When you save a new CV, we'll try to draft your employment history so you can review it instead of entering every role manually."}
      </p>
    </div>
  );
}
