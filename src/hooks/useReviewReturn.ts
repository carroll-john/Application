import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

export function createReviewReturnState(fromReview: boolean) {
  return {
    fromReview,
    previousLabel: fromReview ? "Cancel" : "Previous",
    reviewSuffix: fromReview ? "?from=review" : "",
    returnPath: (defaultPath: string) => (fromReview ? "/review" : defaultPath),
  };
}

export function useReviewReturn() {
  const [searchParams] = useSearchParams();
  const fromReview = searchParams.get("from") === "review";
  const { previousLabel, reviewSuffix } = createReviewReturnState(fromReview);

  const returnPath = useCallback(
    (defaultPath: string) => (fromReview ? "/review" : defaultPath),
    [fromReview],
  );

  return {
    fromReview,
    previousLabel,
    reviewSuffix,
    returnPath,
  };
}
