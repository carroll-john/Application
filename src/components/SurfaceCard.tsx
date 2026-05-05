import type { ReactNode } from "react";
import { cn } from "../lib/utils";

interface SurfaceCardProps {
  children: ReactNode;
  className?: string;
}

export function SurfaceCard({ children, className }: SurfaceCardProps) {
  return (
    <div
      className={cn(
        "rounded-[32px] border border-[var(--border)] bg-white shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}
