import { ModalShell } from "../../components/ModalShell";
import { Button } from "../../components/ui/button";
import type { CourseCatalogEntry } from "../../lib/courseCatalog";
import {
  getCourseEligibilityQuestions,
  type EligibilityAnswers,
} from "../../lib/courseEligibility";
import { EligibilitySelectField } from "./CourseChecklist";

export function EligibilityCheckModal({
  course,
  eligibilityForm,
  isComplete,
  onAnswerChange,
  onClose,
  onComplete,
}: {
  course: CourseCatalogEntry;
  eligibilityForm: EligibilityAnswers;
  isComplete: boolean;
  onAnswerChange: (updates: Partial<EligibilityAnswers>) => void;
  onClose: () => void;
  onComplete: () => void;
}) {
  const questions = getCourseEligibilityQuestions(course);

  return (
    <ModalShell onClose={onClose} title="Entry Requirements Check">
      <p className="mb-6 text-sm leading-6 text-slate-600">
        Answer the program-specific questions so we can guide which evidence you
        will need in the application.
      </p>
      <div className="space-y-4">
        {questions.map((question) => (
          <EligibilitySelectField
            key={question.id}
            label={question.label}
            options={question.options}
            value={eligibilityForm[question.id] ?? ""}
            onChange={(value) =>
              onAnswerChange({ [question.id]: value } as Partial<EligibilityAnswers>)
            }
          />
        ))}
      </div>
      <Button className="mt-6 w-full" disabled={!isComplete} onClick={onComplete}>
        Next
      </Button>
    </ModalShell>
  );
}
