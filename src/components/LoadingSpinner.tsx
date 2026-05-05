import { cn } from "../lib/utils";

export function LoadingSpinner({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <div
      className={cn(
        "animate-spin rounded-full border-4 border-slate-200 border-t-[#1f2a3a]",
        size === "lg" ? "h-10 w-10" : "h-6 w-6",
      )}
    />
  );
}
