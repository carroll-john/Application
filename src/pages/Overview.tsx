import { useNavigate } from "react-router-dom";
import { AppBrandHeader } from "../components/AppBrandHeader";
import { SurfaceCard } from "../components/SurfaceCard";
import { Button } from "../components/ui/button";
import { useApplication } from "../context/ApplicationContext";
import {
  getApplicantDisplayName,
  hasApplicantProfile,
} from "../lib/applicantProfiles";
import {
  getSelectedCourse,
  hasStartedApplication,
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
  const { data, getNextIncompleteSection } = useApplication();
  const hasProfile = hasApplicantProfile(data);
  const started = hasStartedApplication(data);
  const submitted = isApplicationSubmitted(data);
  const selectedCourse = getSelectedCourse(data.applicationMeta);
  const nextPath = getOverviewActionPath(
    getNextIncompleteSection(),
    submitted,
    hasProfile,
  );
  const primaryLabel = !hasProfile
    ? "Create Applicant Profile"
    : submitted
      ? "View Submitted Application"
      : started
        ? "Continue Application"
        : "Start Application";

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
                Desired course intake: {selectedCourse.intake}
              </div>
              <Button
                className="mt-5"
                onClick={() => navigate(nextPath)}
              >
                {primaryLabel}
              </Button>
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard className="mt-6 border-[#084E74]/10 bg-[#F2F8FB] p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#084E74]">
                Applicant profile
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                {hasProfile ? getApplicantDisplayName(data) : "Not set up yet"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                {hasProfile
                  ? `Applications and supporting documents will attach to ${getApplicantDisplayName(
                      data,
                    )}.`
                  : "Before starting the application, create the applicant profile you want to test. This can use any email address."}
              </p>
            </div>
            <Button
              className="sm:min-w-52"
              variant={hasProfile ? "outline" : "soft"}
              onClick={() => navigate("/applicant-profile?redirect=/overview")}
            >
              {hasProfile ? "Edit Applicant Profile" : "Create Applicant Profile"}
            </Button>
          </div>
        </SurfaceCard>

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
      </div>
    </div>
  );
}

function getOverviewActionPath(
  nextSection: string | null,
  submitted: boolean,
  hasProfile: boolean,
) {
  if (!hasProfile) {
    return "/applicant-profile?redirect=/overview";
  }

  if (submitted) {
    return "/submitted";
  }

  if (!nextSection) {
    return "/review";
  }

  const pathMap: Record<string, string> = {
    "Basic information": "/section1/basic-info",
    "Personal contact details": "/section1/personal-contact",
    "Citizenship information": "/section1/contact-info",
    "Address details": "/section1/address",
    "Tertiary qualifications": "/section2/qualifications",
    "CV upload": "/section2/add-cv",
    "Employment experience": "/section2/add-employment",
  };

  return pathMap[nextSection] ?? "/section1/basic-info";
}
