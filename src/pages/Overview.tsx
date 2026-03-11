import { useLocation, useNavigate } from "react-router-dom";
import { AppBrandHeader } from "../components/AppBrandHeader";
import { CopiedApplicationNotice } from "../components/CopiedApplicationNotice";
import { FormActionBar } from "../components/FormActionBar";
import { SurfaceCard } from "../components/SurfaceCard";
import { Button } from "../components/ui/button";
import { useApplication } from "../context/ApplicationContext";
import { getOverviewActionDescriptor } from "../lib/overviewAction";
import { captureApplicationStepEvent } from "../lib/posthog";
import {
  getSelectedCourse,
  isApplicationSubmitted,
} from "../lib/applicationProgress";

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

export default function Overview() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data, getNextIncompleteSection } = useApplication();
  const submitted = isApplicationSubmitted(data);
  const selectedCourse = getSelectedCourse(data.applicationMeta);
  const prefilledFrom = data.applicationMeta.prefilledFrom;
  const nextAction = getOverviewActionDescriptor(
    getNextIncompleteSection(),
    submitted,
  );

  function handleTopActionClick() {
    captureApplicationStepEvent("application_step_completed", {
      application: data,
      pathname: location.pathname,
      properties: {
        action_label: nextAction.primaryLabel,
        next_path: nextAction.path,
      },
    });
    navigate(nextAction.path);
  }

  return (
    <div className="min-h-screen bg-[#f7f7f4] pb-10">
      <AppBrandHeader maxWidthClassName="max-w-5xl" />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <SurfaceCard className="p-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row">
            <div className="h-32 w-full rounded-[28px] bg-[linear-gradient(135deg,#084E74_0%,#0b678f_100%)] sm:w-48" />
            <div className="flex-1">
              <h2 className="text-xl font-bold text-slate-900">
                {selectedCourse.title}
              </h2>
              <div className="mt-4 max-w-xs rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-700">
                Desired course intake: {selectedCourse.intakeLabel}
              </div>
            </div>
          </div>
        </SurfaceCard>

        {prefilledFrom ? (
          <CopiedApplicationNotice className="mt-5" prefilledFrom={prefilledFrom} />
        ) : null}

        <div className="mt-8">
          <h1 className="text-3xl font-bold text-slate-900">
            Application Overview
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
            Be prepared by having your documents ready up front. A typical
            application process can take 30 to 60 minutes to complete. You can
            save your progress at any stage and come back later.
          </p>
        </div>

        <SurfaceCard className="mt-6 border-[#084E74]/10 bg-[#EAF1F5] p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#084E74]">
                <span>{nextAction.label}</span>
                {nextAction.sectionLabel ? (
                  <span className="rounded-full border border-[#084E74]/20 bg-white px-3 py-1 tracking-[0.12em] text-[#084E74]">
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
            <Button
              className="w-full shrink-0 sm:w-auto"
              onClick={handleTopActionClick}
            >
              {nextAction.primaryLabel}
            </Button>
          </div>
        </SurfaceCard>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {overviewSections.map((section) => (
            <SurfaceCard
              key={section.title}
              className="border-[#084E74]/10 bg-[#E4EFEE] p-6"
            >
              <div className="h-16 w-16 rounded-[24px] bg-[#084E74]/10" />
              <p className="mt-4 text-lg font-bold text-[#084E74]">
                {section.title}
              </p>
              <h3 className="mt-2 text-xl font-bold text-slate-900">
                {section.heading}
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                {section.body}
              </p>
            </SurfaceCard>
          ))}
        </div>

        <FormActionBar
          primaryLabel={nextAction.primaryLabel}
          primaryTrackingProperties={{ next_path: nextAction.path }}
          onPrimary={() => {
            navigate(nextAction.path);
          }}
        />
      </div>
    </div>
  );
}
