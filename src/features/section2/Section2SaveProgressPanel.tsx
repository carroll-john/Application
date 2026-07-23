import { Loader2 } from "lucide-react";

interface Section2SaveProgressPanelProps {
  detail: string;
  title: string;
}

export function Section2SaveProgressPanel({
  detail,
  title,
}: Section2SaveProgressPanelProps) {
  return (
    <div
      aria-live="polite"
      className="content-block-compact rounded-2xl border border-[var(--info-border)] bg-[linear-gradient(140deg,#f4fbff_0%,#eef7fc_100%)] px-4 py-4 shadow-[0_14px_30px_rgba(31,42,58,0.08)]"
      role="status"
    >
      <div className="flex items-start gap-3">
        <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-[var(--info-text)]" />
        <div>
          <p className="text-sm font-semibold text-[var(--info-text)]">{title}</p>
          <p className="mt-1 text-sm text-[var(--info-text)]/80">{detail}</p>
        </div>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/60">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-[var(--cta-secondary)]" />
      </div>
    </div>
  );
}
