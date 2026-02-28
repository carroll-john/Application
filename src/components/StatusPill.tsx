import type { ReactNode } from "react";
import { cn } from "../lib/utils";

type StatusPillTone = "info" | "success" | "warning" | "neutral";

const toneClasses: Record<StatusPillTone, string> = {
  info: "bg-[var(--info-bg)] text-[var(--info-text)]",
  success: "bg-[var(--success-bg)] text-[var(--success-text)]",
  warning: "bg-[var(--warning-bg)] text-[var(--warning-text)]",
  neutral: "bg-slate-100 text-slate-700",
};

interface StatusPillProps {
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
  tone?: StatusPillTone;
}

export function StatusPill({
  children,
  className,
  icon,
  tone = "neutral",
}: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium",
        toneClasses[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
