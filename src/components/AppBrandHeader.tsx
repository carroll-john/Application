import type { ReactNode } from "react";

interface AppBrandHeaderProps {
  children?: ReactNode;
  maxWidthClassName?: string;
}

export function AppBrandHeader({
  children,
  maxWidthClassName = "max-w-7xl",
}: AppBrandHeaderProps) {
  return (
    <div className="border-b border-slate-200 bg-white">
      <div
        className={`mx-auto flex items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8 ${maxWidthClassName}`}
      >
        <div className="h-10 w-32 rounded-2xl bg-[#084E74]" />
        {children ? <div className="shrink-0">{children}</div> : null}
      </div>
    </div>
  );
}
