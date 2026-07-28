import { ArrowRight, ClipboardCheck } from "lucide-react";
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
    <ModalShell
      maxWidthClassName="max-w-xl"
      onClose={onClose}
      panelClassName="border border-white/70 shadow-[0_28px_80px_rgba(15,23,42,0.28)]"
      title="Entry Requirements Check"
    >
      <div className="mb-6 flex gap-4 rounded-[22px] bg-[var(--sn-mint-soft)]/45 p-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[var(--sn-navy)] shadow-sm">
          <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="font-semibold text-slate-950">{course.title}</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Answer the program-specific questions so we can guide which evidence
            you will need in the application.
          </p>
        </div>
      </div>
      <div className="space-y-4">
        {questions.map((question) => (
          <div
            key={question.id}
            className="rounded-[20px] border border-slate-200 bg-slate-50 p-4 sm:p-5"
          >
            <EligibilitySelectField
              label={question.label}
              options={question.options}
              value={eligibilityForm[question.id] ?? ""}
              onChange={(value) =>
                onAnswerChange({ [question.id]: value } as Partial<EligibilityAnswers>)
              }
            />
          </div>
        ))}
      </div>
      <Button
        className="mt-6 w-full justify-between px-6"
        disabled={!isComplete}
        onClick={onComplete}
      >
        <span>Next</span>
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </ModalShell>
  );
}
