import type { ReactNode } from "react";
import { ApplicationShell } from "../../components/ApplicationShell";

const REVIEW_PROGRESS = 100;
const REVIEW_SECTION_LABEL = "Section 3 of 3";

interface ReviewStepPageProps {
  children: ReactNode;
  continueDisabled?: boolean;
  continueLabel?: string;
  onContinue: () => void;
  onPrevious: () => void;
  onSaveAndExit?: () => void;
  previousDisabled?: boolean;
  secondaryDisabled?: boolean;
  secondaryLabel?: string;
}

export function ReviewStepPage({
  children,
  continueDisabled,
  continueLabel = "Submit application",
  onContinue,
  onPrevious,
  onSaveAndExit,
  previousDisabled,
  secondaryDisabled,
  secondaryLabel,
}: ReviewStepPageProps) {
  return (
    <ApplicationShell
      continueDisabled={continueDisabled}
      continueLabel={continueLabel}
      description="Please review all information carefully before submitting your application"
      onContinue={onContinue}
      onPrevious={onPrevious}
      onSaveAndExit={onSaveAndExit}
      previousDisabled={previousDisabled}
      previousLabel="Previous"
      progress={REVIEW_PROGRESS}
      secondaryDisabled={secondaryDisabled}
      secondaryLabel={secondaryLabel ?? (onSaveAndExit ? "Save & Exit" : undefined)}
      sectionLabel={REVIEW_SECTION_LABEL}
      title="Review and submit"
    >
      {children}
    </ApplicationShell>
  );
}
