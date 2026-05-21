import { useNavigate } from "react-router-dom";
import { getSection1Step, type Section1StepKey } from "../lib/section1Steps";
import { useReviewReturn } from "./useReviewReturn";

interface UseSection1StepOptions {
  step: Section1StepKey;
  persist: () => void | Promise<void>;
}

export function useSection1Step({ step, persist }: UseSection1StepOptions) {
  const navigate = useNavigate();
  const { fromReview, previousLabel, returnPath } = useReviewReturn();
  const definition = getSection1Step(step);

  const runPersist = () => {
    void persist();
  };

  return {
    fromReview,
    step: definition,
    shellProps: {
      onPrevious: () => {
        runPersist();
        navigate(returnPath(definition.previousPath));
      },
      onSaveAndExit: fromReview
        ? undefined
        : () => {
            runPersist();
            navigate("/dashboard");
          },
      onContinue: () => {
        runPersist();
        navigate(returnPath(definition.continuePath));
      },
      previousLabel,
      continueLabel: fromReview ? "Save & Return to Review" : "Continue",
    },
  };
}
