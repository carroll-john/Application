import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  GraduationCap,
  MapPin,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { SurfaceCard } from "../../components/SurfaceCard";
import { isUcBrand } from "../../lib/brand";
import type { OverviewActionDescriptor } from "../../lib/overviewAction";

interface OverviewContinuePanelProps {
  nextAction: OverviewActionDescriptor;
  onContinue: () => void;
}

export function OverviewContinuePanel({
  nextAction,
  onContinue,
}: OverviewContinuePanelProps) {
  if (isUcBrand) {
    return (
      <UcOverviewContinuePanel
        nextAction={nextAction}
        onContinue={onContinue}
      />
    );
  }

  return (
    <>
      <SurfaceCard className="mt-6 border-[var(--border)] bg-[var(--background-tinted)] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--cta-tertiary-text)]">
              <span>{nextAction.label}</span>
              {nextAction.sectionLabel ? (
                <span className="rounded-full border border-[var(--cta-tertiary-border)] bg-white px-3 py-1 tracking-[0.12em] text-[var(--cta-tertiary-text)]">
                  {nextAction.sectionLabel}
                </span>
              ) : null}
            </div>
            <h2 className="mt-3 text-2xl font-bold text-slate-900">
              {nextAction.title}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-700 sm:text-base">
              {nextAction.description}
            </p>
          </div>
          <div className="hidden shrink-0 sm:block">
            <Button className="w-full sm:w-auto" onClick={onContinue}>
              {nextAction.primaryLabel}
            </Button>
          </div>
        </div>
      </SurfaceCard>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 p-4 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:hidden">
        <Button className="w-full" onClick={onContinue}>
          {nextAction.primaryLabel}
        </Button>
      </div>
    </>
  );
}

const ucActionDetails: Record<
  string,
  { description: string; icon: LucideIcon; primaryLabel?: string }
> = {
  "Basic information": {
    description:
      "Begin with your legal and preferred names. We’ll use these details to set up the rest of your application.",
    icon: UserRound,
    primaryLabel: "Start my application",
  },
  "Personal contact details": {
    description:
      "Add your contact details so UC can keep you updated about your application.",
    icon: UserRound,
  },
  "Citizenship information": {
    description:
      "Tell us about your citizenship and residency so we can show the right application questions.",
    icon: ShieldCheck,
  },
  "Address details": {
    description: "Add your current address to complete your personal profile.",
    icon: MapPin,
  },
  "CV upload": {
    description:
      "Upload your CV so UC Admissions can consider your professional experience alongside your study.",
    icon: FileText,
  },
  "Employment experience": {
    description:
      "Add your recent roles so your relevant experience is clear for admissions review.",
    icon: BriefcaseBusiness,
  },
  "Tertiary qualifications": {
    description:
      "Add your qualifications and upload your transcript. We’ll organise the evidence against this course’s entry requirements.",
    icon: GraduationCap,
  },
  "Review and submit": {
    description:
      "Check your details, resolve anything still missing and submit your application to UC.",
    icon: ClipboardCheck,
  },
  "Submitted application": {
    description:
      "Open your submitted application to review its final details, status and application number.",
    icon: CheckCircle2,
  },
};

function UcOverviewContinuePanel({
  nextAction,
  onContinue,
}: OverviewContinuePanelProps) {
  const actionDetails = ucActionDetails[nextAction.title];
  const Icon = actionDetails?.icon ?? ArrowRight;
  const description = actionDetails?.description ?? nextAction.description;
  const primaryLabel = actionDetails?.primaryLabel ?? nextAction.primaryLabel;

  return (
    <>
      <SurfaceCard className="mt-7 border-l-4 border-l-[var(--brand-accent)] bg-white p-5 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
          <div className="content-block-compact flex h-14 w-14 shrink-0 items-center justify-center bg-[var(--background-soft-blue)] text-[var(--brand-accent-strong)]">
            <Icon aria-hidden="true" className="h-7 w-7" strokeWidth={1.9} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--brand-accent-strong)]">
              {nextAction.label === "Next step" ? "Your next step" : nextAction.label}
              {nextAction.sectionLabel ? ` · ${nextAction.sectionLabel}` : ""}
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">
              {nextAction.title}
            </h2>
            <p className="mt-2 max-w-2xl text-base leading-7 text-slate-600">
              {description}
            </p>
          </div>
          <div className="hidden shrink-0 sm:block">
            <Button className="w-full sm:w-auto" onClick={onContinue}>
              {primaryLabel}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SurfaceCard>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 p-4 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:hidden">
        <Button className="w-full" onClick={onContinue}>
          {primaryLabel}
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Button>
      </div>
    </>
  );
}
