import type { Section1StepDefinition } from "../lib/section1Steps";

export interface Section1ShellNavigationOptions {
  definition: Section1StepDefinition;
  fromReview: boolean;
  navigate: (path: string) => void;
  persist: () => void | Promise<void>;
  previousLabel: string;
  returnPath: (defaultPath: string) => string;
}

export function createSection1ShellNavigation({
  definition,
  fromReview,
  navigate,
  persist,
  previousLabel,
  returnPath,
}: Section1ShellNavigationOptions) {
  const runPersist = () => {
    void persist();
  };

  return {
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
  };
}
