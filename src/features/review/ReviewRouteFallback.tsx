import { ReviewLoadingState } from "./ReviewLoadingState";
import { ReviewStepPage } from "./ReviewStepPage";

/** Suspense fallback for review — matches the hydration placeholder shell. */
export function ReviewRouteFallback() {
  return (
    <ReviewStepPage
      onContinue={() => undefined}
      onPrevious={() => undefined}
      showActionBar={false}
    >
      <ReviewLoadingState />
    </ReviewStepPage>
  );
}
