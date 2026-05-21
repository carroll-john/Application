import { useNavigate } from "react-router-dom";
import { useReviewReturn } from "./useReviewReturn";

interface UseSection1StepOptions {
  previousPath: string;
  continuePath: string;
  persist: () => void | Promise<void>;
}

export function useSection1Step({
  previousPath,
  continuePath,
  persist,
}: UseSection1StepOptions) {
  const navigate = useNavigate();
  const { fromReview, previousLabel, returnPath } = useReviewReturn();

  const runPersist = () => {
    void persist();
  };

  return {
    fromReview,
    shellProps: {
      onPrevious: () => {
        runPersist();
        navigate(returnPath(previousPath));
      },
      onSaveAndExit: fromReview
        ? undefined
        : () => {
            runPersist();
            navigate("/dashboard");
          },
      onContinue: () => {
        runPersist();
        navigate(returnPath(continuePath));
      },
      previousLabel,
      continueLabel: fromReview ? "Save & Return to Review" : "Continue",
    },
  };
}
