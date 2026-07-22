/**
 * Reserves the approximate review layout while application data hydrates.
 * Static blocks only — no validation or action buttons until real content is ready.
 */
export function ReviewLoadingState() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading your application review"
      className="space-y-4 sm:space-y-6"
    >
      <div className="content-block-compact h-16 rounded-lg border border-[var(--info-border)] bg-slate-50" />

      {[0, 1, 2, 3].map((index) => (
        <div
          key={index}
          className="content-block rounded-lg border border-gray-200 border-l-4 border-l-[var(--cta-secondary)] bg-white p-5 shadow-sm sm:p-6"
        >
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="h-4 w-44 max-w-full rounded bg-slate-200" />
            <div className="h-8 w-16 shrink-0 rounded bg-slate-100" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[0, 1, 2, 3].map((field) => (
              <div key={field}>
                <div className="h-3 w-20 rounded bg-slate-100" />
                <div className="mt-1 h-4 w-32 max-w-full rounded bg-slate-200" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
