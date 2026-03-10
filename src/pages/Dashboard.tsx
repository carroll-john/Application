import { BookOpen, CheckCircle2, Clock, FileText } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AppBrandHeader } from "../components/AppBrandHeader";
import { StatusPill } from "../components/StatusPill";
import { SurfaceCard } from "../components/SurfaceCard";
import { Button } from "../components/ui/button";
import { useApplication } from "../context/ApplicationContext";
import { useAuth } from "../context/AuthContext";
import type { ApplicationSummary } from "../lib/applicationRecords";
import { formatApplicationDate, getSelectedCourse } from "../lib/applicationProgress";
import { capturePostHogEvent } from "../lib/posthog";

type DashboardTab = "all" | "draft" | "submitted";

interface DashboardTabDefinition {
  emptyBody: string;
  emptyTitle: string;
  icon: ReactNode;
  key: DashboardTab;
  label: string;
  tone: "blue" | "green" | "orange";
}

const dashboardTabs: DashboardTabDefinition[] = [
  {
    key: "all",
    label: "All applications",
    tone: "blue",
    icon: <BookOpen className="h-5 w-5" />,
    emptyTitle: "No applications yet",
    emptyBody: "Start an application from a course page to see it here.",
  },
  {
    key: "draft",
    label: "Open",
    tone: "orange",
    icon: <Clock className="h-5 w-5" />,
    emptyTitle: "No open applications",
    emptyBody: "Applications still in progress will appear here.",
  },
  {
    key: "submitted",
    label: "Submitted",
    tone: "green",
    icon: <CheckCircle2 className="h-5 w-5" />,
    emptyTitle: "No submitted applications",
    emptyBody: "Submitted applications will appear here after final submission.",
  },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { companyUserDisplayName, signOut } = useAuth();
  const {
    activeApplicationId,
    applicantProfile,
    applications,
    openApplication,
  } = useApplication();
  const [activeTab, setActiveTab] = useState<DashboardTab>("all");

  const filteredApplications = useMemo(() => {
    if (activeTab === "all") {
      return applications;
    }

    return applications.filter((application) => application.status === activeTab);
  }, [activeTab, applications]);

  const tabCounts = useMemo(
    () => ({
      all: applications.length,
      draft: applications.filter((application) => application.status === "draft")
        .length,
      submitted: applications.filter(
        (application) => application.status === "submitted",
      ).length,
    }),
    [applications],
  );

  const activeTabDefinition =
    dashboardTabs.find((tab) => tab.key === activeTab) ?? dashboardTabs[0];

  return (
    <div className="min-h-screen bg-[#f7f7f4]">
      <AppBrandHeader>
        <Button
          className="rounded-2xl shadow-none"
          onClick={async () => {
            await signOut();
            navigate("/");
          }}
          variant="outline"
        >
          Log out
        </Button>
      </AppBrandHeader>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-950 sm:text-4xl">
              Welcome back, {companyUserDisplayName}
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
              {applicantProfile
                ? `Your profile is ready. Start a new course application or continue an open one below.`
                : "Browse courses, pass eligibility, and start an application from the course page."}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => navigate("/")} variant="outline">
              Browse courses
            </Button>
            <Button onClick={() => navigate("/admissions")} variant="outline">
              Admissions workspace
            </Button>
          </div>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          {dashboardTabs.map((tab) => (
            <DashboardStatCard
              key={tab.key}
              active={activeTab === tab.key}
              count={tabCounts[tab.key]}
              icon={tab.icon}
              label={tab.label}
              tone={tab.tone}
              onClick={() => setActiveTab(tab.key)}
            />
          ))}
        </div>

        {filteredApplications.length === 0 ? (
          <SurfaceCard className="rounded-[32px] p-10 text-center">
            <div className="mx-auto flex max-w-lg flex-col items-center">
              <div className="rounded-full bg-slate-100 p-4 text-slate-500">
                {activeTabDefinition.icon}
              </div>
              <h2 className="mt-5 text-2xl font-bold text-slate-950">
                {activeTabDefinition.emptyTitle}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {activeTabDefinition.emptyBody}
              </p>
              <Button className="mt-6" onClick={() => navigate("/")}>
                View courses
              </Button>
            </div>
          </SurfaceCard>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {filteredApplications.map((application) => (
              <ApplicationCard
                key={application.id}
                application={application}
                isActive={application.id === activeApplicationId}
                onOpen={async () => {
                  capturePostHogEvent("application_opened_from_dashboard", {
                    application_id: application.id,
                    application_number: application.applicationNumber ?? null,
                    application_status: application.status,
                    course_code: application.course.code,
                    course_intake: application.course.intake,
                    course_provider: application.course.provider,
                    course_title: application.course.title,
                    is_active_application: application.id === activeApplicationId,
                  });
                  await openApplication(application.id);
                  navigate(
                    application.status === "submitted" ? "/submitted" : "/overview",
                  );
                }}
                onViewCourse={() => navigate(`/courses/${application.course.code}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DashboardStatCard({
  label,
  count,
  icon,
  active,
  tone,
  onClick,
}: {
  label: string;
  count: number;
  icon: ReactNode;
  active: boolean;
  tone: "orange" | "blue" | "green";
  onClick: () => void;
}) {
  const tones = {
    orange: active
      ? "border-amber-500 ring-2 ring-amber-200"
      : "border-slate-200 hover:border-amber-300",
    blue: active
      ? "border-sky-500 ring-2 ring-sky-200"
      : "border-slate-200 hover:border-sky-300",
    green: active
      ? "border-green-500 ring-2 ring-green-200"
      : "border-slate-200 hover:border-green-300",
  };

  return (
    <button
      className={`rounded-[28px] border-2 bg-white p-5 text-left shadow-sm transition-all ${tones[tone]}`}
      type="button"
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{count}</p>
        </div>
        <div className="rounded-full bg-slate-100 p-3 text-slate-600">{icon}</div>
      </div>
    </button>
  );
}

function ApplicationCard({
  application,
  isActive,
  onOpen,
  onViewCourse,
}: {
  application: ApplicationSummary;
  isActive: boolean;
  onOpen: () => void;
  onViewCourse: () => void;
}) {
  const selectedCourse = getSelectedCourse({
    selectedCourse: {
      code: application.course.code,
      intake: application.course.intake,
      provider: application.course.provider,
      title: application.course.title,
    },
  });

  return (
    <SurfaceCard className="rounded-[32px] p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {application.course.provider}
          </p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">
            {application.course.title}
          </h2>
        </div>
        <StatusPill
          icon={
            application.status === "submitted" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Clock className="h-4 w-4" />
            )
          }
          tone={application.status === "submitted" ? "success" : "warning"}
        >
          {application.status === "submitted" ? "Submitted" : "Open"}
        </StatusPill>
      </div>

      <div className="mt-5 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
        <DashboardMeta label="Delivery" value={selectedCourse.delivery || "Not set"} />
        <DashboardMeta label="Intake" value={application.course.intake} />
        <DashboardMeta
          label="Updated"
          value={formatApplicationDate(application.updatedAt) || "Today"}
        />
        <DashboardMeta
          label="Application #"
          value={application.applicationNumber ?? "Pending"}
        />
      </div>

      {isActive ? (
        <div className="mt-5 rounded-2xl border border-[var(--info-border)] bg-[var(--info-bg)] px-4 py-3 text-sm font-medium text-[var(--info-text)]">
          This is your current active application.
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button className="sm:flex-1" onClick={onOpen}>
          {application.status === "submitted"
            ? "View submitted application"
            : "Continue application"}
        </Button>
        <Button className="sm:flex-1" onClick={onViewCourse} variant="outline">
          View course
        </Button>
      </div>
    </SurfaceCard>
  );
}

function DashboardMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <span className="block text-xs uppercase tracking-[0.16em] text-slate-500">
        {label}
      </span>
      <span className="mt-1 block font-medium text-slate-900">{value}</span>
    </div>
  );
}
