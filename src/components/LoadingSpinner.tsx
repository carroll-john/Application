import { cn } from "../lib/utils";

export function LoadingSpinner({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <div
      className={cn(
        "animate-spin rounded-full border-4 border-slate-200 border-t-[#084E74]",
        size === "lg" ? "h-10 w-10" : "h-6 w-6",
      )}
    />
  );
}
