/**
 * Reserves the approximate Section 2 hub layout while application data hydrates.
 * Static blocks only — no spinners or action buttons until real content is ready.
 */
export function Section2QualificationsLoadingState() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading your qualifications"
      className="space-y-6 sm:space-y-8"
    >
      <div className="rounded-lg border border-[var(--info-border)] bg-white p-4 sm:p-5">
        <div className="h-4 w-56 max-w-full rounded bg-slate-200" />
        <div className="mt-3 h-3 w-full max-w-2xl rounded bg-slate-100" />
        <div className="mt-2 h-3 max-w-xl rounded bg-slate-100" />
        <div className="mt-4 h-24 rounded-md bg-slate-50" />
      </div>

      <div className="space-y-6">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6"
          >
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 shrink-0 rounded bg-slate-200" />
              <div className="h-4 w-40 rounded bg-slate-200" />
            </div>
            <div className="mt-4 h-14 rounded-md bg-slate-50" />
          </div>
        ))}
      </div>
    </div>
  );
}
