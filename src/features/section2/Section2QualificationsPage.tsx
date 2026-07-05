import type { ReactNode } from "react";
import { ApplicationShell } from "../../features/forms";
import { SECTION2_SECTION_LABEL } from "../../lib/section2Steps";

const SECTION2_PROGRESS = 66;

interface Section2QualificationsPageProps {
  children: ReactNode;
  continueDisabled?: boolean;
  continueLabel?: string;
  onContinue: () => void;
  onPrevious: () => void;
  onSaveAndExit?: () => void;
  previousDisabled?: boolean;
  previousLabel?: string;
  secondaryDisabled?: boolean;
  secondaryLabel?: string;
  showActionBar?: boolean;
}

export function Section2QualificationsPage({
  children,
  continueDisabled,
  continueLabel = "Save & Continue",
  onContinue,
  onPrevious,
  onSaveAndExit,
  previousDisabled,
  previousLabel = "Previous",
  secondaryDisabled,
  secondaryLabel,
  showActionBar = true,
}: Section2QualificationsPageProps) {
  return (
    <ApplicationShell
      continueDisabled={continueDisabled}
      continueLabel={continueLabel}
      description="Work through each section to build your application."
      onContinue={onContinue}
      onPrevious={onPrevious}
      onSaveAndExit={onSaveAndExit}
      previousDisabled={previousDisabled}
      previousLabel={previousLabel}
      secondaryDisabled={secondaryDisabled}
      secondaryLabel={secondaryLabel}
      showActionBar={showActionBar}
      progress={SECTION2_PROGRESS}
      sectionLabel={SECTION2_SECTION_LABEL}
      title="Your qualifications"
    >
      {children}
    </ApplicationShell>
  );
}
