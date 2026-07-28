import type { ReactNode } from "react";
import { cn } from "../lib/utils";

// `accentSoft` is yellow-tinted (legacy Apply look); the design system kit
// uses mint as the brand accent, so new code should prefer `mintSoft`.
type AccentIconBadgeTone =
  | "brand"
  | "brandSoft"
  | "accentSoft"
  | "inverseSoft"
  | "mint"
  | "mintSoft"
  | "yellow";
type AccentIconBadgeSize = "md" | "lg";

const toneClasses: Record<AccentIconBadgeTone, string> = {
  accentSoft: "bg-[var(--cta-primary)]/20 text-[var(--cta-secondary)]",
  brand: "bg-[var(--cta-secondary)] text-white",
  brandSoft: "bg-[var(--cta-secondary)]/10 text-[var(--cta-secondary)]",
  inverseSoft: "bg-white/10 text-white",
  mint: "bg-[var(--sn-mint)] text-[var(--sn-navy)]",
  mintSoft: "bg-[var(--sn-mint)]/20 text-[var(--sn-navy)]",
  yellow: "bg-[var(--sn-yellow)] text-[var(--sn-navy)]",
};

const sizeClasses: Record<AccentIconBadgeSize, string> = {
  lg: "h-14 w-14 rounded-[24px]",
  md: "h-12 w-12 rounded-full",
};

interface AccentIconBadgeProps {
  children: ReactNode;
  className?: string;
  size?: AccentIconBadgeSize;
  tone?: AccentIconBadgeTone;
}

export function AccentIconBadge({
  children,
  className,
  size = "md",
  tone = "brandSoft",
}: AccentIconBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center",
        toneClasses[tone],
        sizeClasses[size],
        className,
      )}
    >
      {children}
    </div>
  );
}
