import type { ReactNode } from "react";
import { ApplicationShell } from "../../features/forms";
import { StatusMessage } from "../../components/StatusMessage";
import { useSection2Navigation } from "../../hooks/useSection2Navigation";
import type { Section2RecordStatusMessage } from "../../hooks/useSection2RecordSave";
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
  navigateAfterSave?: boolean;
  onContinue?: () => void | Promise<void>;
  onDismissStatus?: () => void;
  onSave?: () => void | Promise<void>;
  statusMessage?: Section2RecordStatusMessage | null;
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
  navigateAfterSave = true,
  onContinue,
  onDismissStatus,
  onSave,
  statusMessage,
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
      if (navigateAfterSave) {
        returnToQualifications();
      }
    });
  };

  return (
    <ApplicationShell
      className={className}
      continueDisabled={continueDisabled}
      continueLabel={continueLabel}
      description={description}
      onContinue={handleContinue}
      progress={SECTION2_PROGRESS}
      sectionLabel={SECTION2_SECTION_LABEL}
      title={isEditing ? editTitle : addTitle}
    >
      {statusMessage ? (
        <div className="mb-6">
          <StatusMessage
            message={statusMessage.message}
            type={statusMessage.type}
            onDismiss={onDismissStatus ?? (() => undefined)}
          />
        </div>
      ) : null}
      {children}
    </ApplicationShell>
  );
}
