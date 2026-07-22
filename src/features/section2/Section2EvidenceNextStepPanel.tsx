import { Button } from "../../components/ui/button";
import type { Section2EvidencePlan, Section2EvidenceSectionKey } from "./section2EvidencePlan";

interface Section2EvidenceNextStepPanelProps {
  isProcessing: boolean;
  onNavigate: (path: string) => void;
  onSkipPrompt: (section: Section2EvidenceSectionKey) => void;
  plan: Section2EvidencePlan;
}

export function Section2EvidenceNextStepPanel({
  isProcessing,
  onNavigate,
  onSkipPrompt,
  plan,
}: Section2EvidenceNextStepPanelProps) {
  const prompt = plan.nextPrompt;

  if (isProcessing || !prompt) {
    return null;
  }

  return (
    <div
      aria-label="Next evidence step"
      className="content-block mb-6 rounded-lg border border-[var(--info-border)] bg-white p-4 sm:mb-8 sm:p-5"
    >
      <div className="content-block-compact rounded-md border-2 border-[var(--cta-secondary)] bg-[var(--info-bg)] p-3">
        <p className="text-xs font-semibold text-gray-900 sm:text-sm">
          Next step: {prompt.heading}
        </p>
        {prompt.explanationItems && prompt.explanationItems.length > 0 ? (
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-gray-700 sm:text-sm">
            {prompt.explanationItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-gray-700 sm:text-sm">{prompt.explanation}</p>
        )}
        {plan.remainingPromptCount > 1 ? (
          <p className="mt-1 text-xs text-gray-500">
            Step 1 of {plan.remainingPromptCount} — the next step appears once this one is
            done.
          </p>
        ) : null}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            onClick={() => onSkipPrompt(prompt.sectionKey)}
            type="button"
            variant="outline"
          >
            Skip for now
          </Button>
          <Button onClick={() => onNavigate(prompt.actionPath)} type="button">
            {prompt.actionLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
