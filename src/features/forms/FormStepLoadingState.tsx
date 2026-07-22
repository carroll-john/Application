/**
 * Reserves the approximate form step layout while application data hydrates.
 * Static blocks only — no spinners or action buttons until real content is ready.
 */
export function FormStepLoadingState({
  includeShellHeader = false,
}: {
  includeShellHeader?: boolean;
}) {
  return (
    <div aria-busy="true" aria-label="Loading form" className="space-y-6">
      {includeShellHeader ? (
        <>
          <div className="mb-6 sm:mb-8">
            <div className="mb-2 flex items-center justify-between">
              <div className="h-4 w-24 rounded bg-slate-200" />
              <div className="h-4 w-8 rounded bg-slate-200" />
            </div>
            <div className="h-2 rounded-full bg-slate-200" />
          </div>
          <div className="h-8 w-64 max-w-full rounded bg-slate-200" />
          <div className="mb-6 mt-2 h-4 w-full max-w-xl rounded bg-slate-100 sm:mb-8" />
        </>
      ) : null}

      {[0, 1].map((index) => (
        <div
          key={index}
          className="content-block rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <div className="mb-5 flex items-start gap-3">
            <div className="h-6 w-6 shrink-0 rounded bg-slate-200" />
            <div className="flex-1">
              <div className="h-4 w-36 max-w-full rounded bg-slate-200" />
              <div className="mt-2 h-3 w-full max-w-md rounded bg-slate-100" />
            </div>
          </div>
          <div className="space-y-5">
            {[0, 1, 2].map((field) => (
              <div key={field}>
                <div className="h-3 w-24 rounded bg-slate-100" />
                <div className="mt-2 h-10 w-full rounded-md bg-slate-50" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
