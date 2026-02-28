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
          <span className="text-xs font-medium text-gray-700 sm:text-sm">
            {sectionLabel}
          </span>
          <span className="text-xs font-medium text-gray-700 sm:text-sm">
            {progress}%
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-gray-200">
          <div
            className="h-2 rounded-full bg-[#084E74] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="mb-6 sm:mb-8">
        <h1 className="mb-2 text-2xl font-bold text-gray-900 sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="text-sm text-gray-600 sm:text-base">{description}</p>
        ) : null}
      </div>
    </>
  );
}
