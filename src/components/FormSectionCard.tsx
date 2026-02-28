import type { ReactNode } from "react";
import { cn } from "../lib/utils";

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
        "rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6",
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
