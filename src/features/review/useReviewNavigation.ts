import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { ValidationIssue } from "../../lib/applicationValidationSchema";
import {
  consumeReviewValidationFlag,
  setReviewValidationFlag,
} from "../../lib/reviewFormatters";

export function useReviewNavigation(validationErrors: ValidationIssue[]) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!consumeReviewValidationFlag()) return;

    if (validationErrors.length > 0) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [validationErrors]);

  const navigateToReviewEdit = (path: string) => {
    setReviewValidationFlag();
    navigate(path);
  };

  return { navigateToReviewEdit };
}
