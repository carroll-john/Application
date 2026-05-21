import { ModalShell } from "../../components/ModalShell";
import { Button } from "../../components/ui/button";
import type { CourseCatalogEntry } from "../../lib/courseCatalog";
import type { EligibilityAnswers } from "../../lib/courseEligibility";
import { EligibilitySelectField } from "./CourseChecklist";

export function EligibilityCheckModal({
  course,
  eligibilityForm,
  isComplete,
  requiresExperienceInput,
  onAnswerChange,
  onClose,
  onComplete,
}: {
  course: CourseCatalogEntry;
  eligibilityForm: EligibilityAnswers;
  isComplete: boolean;
  requiresExperienceInput: boolean;
  onAnswerChange: (updates: Partial<EligibilityAnswers>) => void;
  onClose: () => void;
  onComplete: () => void;
}) {
  return (
    <ModalShell onClose={onClose} title="Eligibility Check">
      <p className="mb-6 text-sm leading-6 text-slate-600">
        Answer a few questions so we can check this course&apos;s entry criteria
        before you start an application.
      </p>
      <div className="space-y-4">
        <EligibilitySelectField
          label="Select: Education level"
          options={course.eligibility.educationOptions}
          value={eligibilityForm.educationLevel ?? ""}
          onChange={(value) => onAnswerChange({ educationLevel: value })}
        />
        {requiresExperienceInput ? (
          <EligibilitySelectField
            label="Select: Experience"
            options={course.eligibility.experienceOptions}
            value={eligibilityForm.experienceRange ?? ""}
            onChange={(value) => onAnswerChange({ experienceRange: value })}
          />
        ) : null}
      </div>
      <Button className="mt-6 w-full" disabled={!isComplete} onClick={onComplete}>
        Next
      </Button>
    </ModalShell>
  );
}
