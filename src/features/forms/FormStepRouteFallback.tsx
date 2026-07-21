import { FormStepLoadingState } from "./FormStepLoadingState";

/** Suspense fallback for Section 1 and Section 2 record routes. */
export function FormStepRouteFallback() {
  return (
    <div className="bg-[var(--background)] pb-12">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <FormStepLoadingState includeShellHeader />
      </div>
    </div>
  );
}
