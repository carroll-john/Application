import type { ReactNode } from "react";
import { ApplicationShell } from "../../components/ApplicationShell";
import { useSection2Navigation } from "../../hooks/useSection2Navigation";
import { SECTION2_SECTION_LABEL } from "../../lib/section2Steps";

const SECTION2_PROGRESS = 66;

interface Section2RecordPageProps {
  addTitle: string;
  beforeContinue?: () => boolean;
  children: ReactNode;
  className?: string;
  continueDisabled?: boolean;
  continueLabel?: string;
  description: string;
  editTitle: string;
  isEditing: boolean;
  onContinue?: () => void | Promise<void>;
  onPrevious?: () => void;
  onSave?: () => void | Promise<void>;
  previousDisabled?: boolean;
}

export function Section2RecordPage({
  addTitle,
  beforeContinue,
  children,
  className,
  continueDisabled,
  continueLabel = "Save & Continue",
  description,
  editTitle,
  isEditing,
  onContinue,
  onPrevious,
  onSave,
  previousDisabled,
}: Section2RecordPageProps) {
  const { returnToQualifications } = useSection2Navigation();

  const handleContinue = () => {
    if (onContinue) {
      void Promise.resolve(onContinue());
      return;
    }

    if (beforeContinue && !beforeContinue()) {
      return;
    }

    void Promise.resolve(onSave?.()).then(() => {
      returnToQualifications();
    });
  };

  return (
    <ApplicationShell
      className={className}
      continueDisabled={continueDisabled}
      continueLabel={continueLabel}
      description={description}
      onContinue={handleContinue}
      onPrevious={onPrevious ?? returnToQualifications}
      previousDisabled={previousDisabled}
      previousLabel="Cancel"
      progress={SECTION2_PROGRESS}
      sectionLabel={SECTION2_SECTION_LABEL}
      title={isEditing ? editTitle : addTitle}
    >
      {children}
    </ApplicationShell>
  );
}
