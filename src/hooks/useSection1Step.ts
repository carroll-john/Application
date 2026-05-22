import { useNavigate } from "react-router-dom";
import { getSection1Step, type Section1StepKey } from "../lib/section1Steps";
import { createSection1ShellNavigation } from "./section1Navigation";
import { useReviewReturn } from "./useReviewReturn";

interface UseSection1StepOptions {
  step: Section1StepKey;
  persist: () => void | Promise<void>;
  beforeContinue?: () => boolean;
}

export function useSection1Step({
  step,
  persist,
  beforeContinue,
}: UseSection1StepOptions) {
  const navigate = useNavigate();
  const { fromReview, previousLabel, returnPath } = useReviewReturn();
  const definition = getSection1Step(step);
  const shellProps = createSection1ShellNavigation({
    definition,
    fromReview,
    navigate,
    persist,
    previousLabel,
    returnPath,
  });

  return {
    fromReview,
    step: definition,
    shellProps: {
      ...shellProps,
      onContinue: () => {
        if (beforeContinue && !beforeContinue()) {
          return;
        }

        shellProps.onContinue();
      },
    },
  };
}
