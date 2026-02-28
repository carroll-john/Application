import * as React from "react";
import { cn } from "../../lib/utils";

type ButtonVariant = "default" | "neutralOutline" | "outline" | "soft";
type ButtonSize = "default" | "sm";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  default:
    "bg-[var(--cta-primary)] text-[#1f2937] hover:bg-[var(--cta-primary-hover)] active:bg-[var(--cta-primary-pressed)] shadow-[0_8px_20px_rgba(244,207,10,0.22)]",
  neutralOutline:
    "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 shadow-none",
  outline:
    "border border-[var(--cta-tertiary-border)] bg-[var(--cta-tertiary-bg)] text-[var(--cta-tertiary-text)] hover:bg-[var(--cta-tertiary-hover)] active:bg-[var(--cta-tertiary-pressed)] shadow-none",
  soft: "bg-[var(--cta-secondary)] text-white hover:bg-[var(--cta-secondary-hover)] active:bg-[var(--cta-secondary-pressed)] shadow-[0_8px_20px_rgba(8,78,116,0.18)]",
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "h-11 px-5 py-2.5 text-sm sm:text-base",
  sm: "h-9 px-3 text-sm",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  ),
);

Button.displayName = "Button";
