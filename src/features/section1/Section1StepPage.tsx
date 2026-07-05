import type { ReactNode } from "react";
import { useApplication } from "../../context/ApplicationContext";
import { ApplicationShell, FormStepLoadingState } from "../../features/forms";
import { useSection1Step } from "../../hooks/useSection1Step";
import type { Section1StepKey } from "../../lib/section1Steps";

interface Section1StepPageProps {
  beforeContinue?: () => boolean;
  children: ReactNode;
  onContinue?: () => void;
  persist: () => void | Promise<void>;
  step: Section1StepKey;
}

export function Section1StepPage({
  beforeContinue,
  children,
  onContinue,
  persist,
  step,
}: Section1StepPageProps) {
  const { isHydrating } = useApplication();
  const { shellProps, step: definition } = useSection1Step({
    beforeContinue,
    persist,
    step,
  });

  return (
    <ApplicationShell
      sectionLabel={definition.sectionLabel}
      progress={definition.progress}
      title={definition.title}
      description={definition.description}
      {...shellProps}
      continueDisabled={isHydrating}
      onContinue={onContinue ?? shellProps.onContinue}
      previousDisabled={isHydrating}
      secondaryDisabled={isHydrating}
      showActionBar={!isHydrating}
    >
      {isHydrating ? <FormStepLoadingState /> : children}
    </ApplicationShell>
  );
}
