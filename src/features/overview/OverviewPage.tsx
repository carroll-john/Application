import { AppBrandHeader } from "../../components/AppBrandHeader";
import { CopiedApplicationNotice } from "../../components/CopiedApplicationNotice";
import { SurfaceCard } from "../../components/SurfaceCard";
import type { ApplicationPrefillSource } from "../../lib/applicationData";
import type { OverviewActionDescriptor } from "../../lib/overviewAction";
import { OverviewContinuePanel } from "./OverviewContinuePanel";

const overviewSections = [
  {
    title: "Section 1",
    heading: "Personal details",
    body:
      "Your personal details include name, address, and core eligibility information.",
  },
  {
    title: "Section 2",
    heading: "Your qualifications",
    body:
      "Add your education history, upload supporting documents, and share your work experience.",
  },
  {
    title: "Section 3",
    heading: "Review and submit",
    body:
      "Confirm everything before final submission and resolve any missing fields.",
  },
] as const;

interface OverviewPageProps {
  intakeLabel: string;
  nextAction: OverviewActionDescriptor;
  onContinue: () => void;
  prefilledFrom?: ApplicationPrefillSource;
  title: string;
}

export function OverviewPage({
  intakeLabel,
  nextAction,
  onContinue,
  prefilledFrom,
  title,
}: OverviewPageProps) {
  return (
    <div className="min-h-screen bg-[var(--background)] pb-28 sm:pb-10">
      <AppBrandHeader maxWidthClassName="max-w-5xl" />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <SurfaceCard className="p-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row">
            <div className="brand-hero h-32 w-full rounded-[28px] sm:w-48" />
            <div className="flex-1">
              <h2 className="text-xl font-bold text-slate-900">{title}</h2>
              <div className="mt-4 max-w-xs rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-700">
                Desired course intake: {intakeLabel}
              </div>
            </div>
          </div>
        </SurfaceCard>

        {prefilledFrom ? (
          <CopiedApplicationNotice className="mt-5" prefilledFrom={prefilledFrom} />
        ) : null}

        <div className="mt-8">
          <h1 className="text-3xl font-bold text-slate-900">Application Overview</h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
            Be prepared by having your documents ready up front. A typical
            application process can take 30 to 60 minutes to complete. You can
            save your progress at any stage and come back later.
          </p>
        </div>

        <OverviewContinuePanel nextAction={nextAction} onContinue={onContinue} />

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {overviewSections.map((section) => (
            <OverviewSectionCard key={section.title} section={section} />
          ))}
        </div>
      </div>
    </div>
  );
}

function OverviewSectionCard({
  section,
}: {
  section: (typeof overviewSections)[number];
}) {
  return (
    <SurfaceCard className="border-[var(--cta-secondary)]/10 bg-[var(--background-soft-blue)] p-6">
      <div className="h-16 w-16 rounded-[24px] bg-[var(--cta-secondary)]/10" />
      <p className="mt-4 text-lg font-bold text-[var(--cta-secondary)]">
        {section.title}
      </p>
      <h3 className="mt-2 text-xl font-bold text-slate-900">{section.heading}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-700">{section.body}</p>
    </SurfaceCard>
  );
}
