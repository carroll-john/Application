import {
  BookOpen,
  CheckCircle2,
  Clock,
  Edit,
  Eye,
  FileText,
  Heart,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppBrandHeader } from "../components/AppBrandHeader";
import { StatusPill } from "../components/StatusPill";
import { SurfaceCard } from "../components/SurfaceCard";
import { Button } from "../components/ui/button";
import { useApplication } from "../context/ApplicationContext";
import { useAuth } from "../context/AuthContext";
import {
  getApplicantDisplayName,
  hasApplicantProfile,
} from "../lib/applicantProfiles";
import {
  formatApplicationDate,
  getSelectedCourse,
  hasStartedApplication,
  isApplicationSubmitted,
} from "../lib/applicationProgress";

type DashboardTab =
  | "all"
  | "shortlisted"
  | "in-progress"
  | "submitted"
  | "accepted";
type FilteredDashboardTab = Exclude<DashboardTab, "all">;

interface DashboardPanelDefinition {
  emptyBody: string;
  emptyTitle: string;
  icon: ReactNode;
  label: string;
  tone: "blue" | "green" | "orange" | "red";
}

interface DashboardTabDefinition extends DashboardPanelDefinition {
  key: FilteredDashboardTab;
}

interface ApplicationCardData {
  applicationNumber?: string;
  id: string;
  intake: string;
  nextStep?: string | null;
  status: "submitted" | "in-progress";
  submittedDate?: string;
  title: string;
}

interface DashboardPrimaryAction {
  disabled?: boolean;
  label: string;
  onClick?: () => void;
  variant: "default" | "soft";
}

const dashboardTabs: DashboardTabDefinition[] = [
  {
    key: "in-progress",
    label: "In Progress",
    tone: "orange",
    icon: <Clock className="h-4 w-4 sm:h-5 sm:w-5" />,
    emptyTitle: "No applications in progress",
    emptyBody: "You don't have any applications in progress at the moment.",
  },
  {
    key: "submitted",
    label: "Submitted",
    tone: "blue",
    icon: <FileText className="h-4 w-4 sm:h-5 sm:w-5" />,
    emptyTitle: "No submitted applications",
    emptyBody: "You don't have any submitted applications yet.",
  },
  {
    key: "accepted",
    label: "Accepted",
    tone: "green",
    icon: <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />,
    emptyTitle: "No accepted applications",
    emptyBody: "Accepted applications will appear here once an offer is made.",
  },
  {
    key: "shortlisted",
    label: "Shortlisted",
    tone: "red",
    icon: <Heart className="h-4 w-4 sm:h-5 sm:w-5" />,
    emptyTitle: "No shortlisted courses",
    emptyBody: "Shortlisted courses will appear here when that flow is enabled.",
  },
];

const allTabDefinition: DashboardPanelDefinition = {
  label: "All Applications",
  tone: "blue",
  icon: <BookOpen className="h-8 w-8 text-gray-400" />,
  emptyTitle: "No applications yet",
  emptyBody:
    "Start your application to track progress, manage documents, and return to review when you're ready.",
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { companyUserDisplayName, signOut } = useAuth();
  const { data, getNextIncompleteSection, resetApplication } = useApplication();
  const [activeTab, setActiveTab] = useState<DashboardTab>("all");

  const nextSection = getNextIncompleteSection();
  const hasProfile = hasApplicantProfile(data);
  const nextPath = getDashboardResumePath(nextSection, hasProfile);
  const started = hasStartedApplication(data);
  const submitted = isApplicationSubmitted(data);
  const selectedCourse = getSelectedCourse(data.applicationMeta);

  const currentApplication = useMemo<ApplicationCardData | null>(() => {
    if (!started && !submitted) {
      return null;
    }

    return {
      applicationNumber: data.applicationMeta.applicationNumber,
      id: "current-application",
      intake: selectedCourse.intake,
      nextStep: nextSection,
      status: submitted ? "submitted" : "in-progress",
      submittedDate: formatApplicationDate(data.applicationMeta.submittedAt),
      title: selectedCourse.title,
    };
  }, [
    data.applicationMeta.applicationNumber,
    data.applicationMeta.submittedAt,
    nextSection,
    selectedCourse.intake,
    selectedCourse.title,
    started,
    submitted,
  ]);

  const tabCounts = useMemo(
    () => ({
      accepted: 0,
      "in-progress": currentApplication?.status === "in-progress" ? 1 : 0,
      shortlisted: 0,
      submitted: currentApplication?.status === "submitted" ? 1 : 0,
    }),
    [currentApplication],
  );

  const filteredApplications = useMemo(() => {
    if (!currentApplication) {
      return [];
    }

    if (activeTab === "all") {
      return [currentApplication];
    }

    if (activeTab === "in-progress" && currentApplication.status === "in-progress") {
      return [currentApplication];
    }

    if (activeTab === "submitted" && currentApplication.status === "submitted") {
      return [currentApplication];
    }

    return [];
  }, [activeTab, currentApplication]);

  const activeTabDefinition =
    activeTab === "all"
      ? allTabDefinition
      : dashboardTabs.find((tab) => tab.key === activeTab) ?? allTabDefinition;

  return (
    <div className="min-h-screen bg-gray-50">
      <AppBrandHeader>
        <Button
          className="rounded-lg px-3 text-sm shadow-none sm:px-4 sm:text-base"
          onClick={async () => {
            resetApplication();
            await signOut();
            navigate("/");
          }}
          variant="outline"
        >
          Logout
        </Button>
      </AppBrandHeader>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="mb-2 text-2xl font-bold text-gray-900 sm:text-3xl">
            Welcome back, {companyUserDisplayName}!
          </h1>
          <p className="text-sm text-gray-600 sm:text-base">
            {hasProfile
              ? `You are currently working on ${getApplicantDisplayName(
                  data,
                )}'s application.`
              : "Set up an applicant profile, then start working through the application."}
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 sm:mb-8 sm:gap-4 lg:grid-cols-4">
          {dashboardTabs.map((tab) => (
            <StatCard
              key={tab.key}
              active={activeTab === tab.key}
              count={tabCounts[tab.key]}
              icon={tab.icon}
              label={tab.label}
              onClick={() => setActiveTab(tab.key)}
              tone={tab.tone}
            />
          ))}
        </div>

        <SurfaceCard className="mb-6 rounded-[28px] px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <button
              className={`text-base font-semibold transition-colors sm:text-lg ${
                activeTab === "all"
                  ? "text-[#084E74]"
                  : "text-gray-900 hover:text-[#084E74]"
              }`}
              type="button"
              onClick={() => setActiveTab("all")}
            >
              My Applications{" "}
              {activeTab === "all" ? `(${filteredApplications.length || 0})` : ""}
            </button>
            <Button
              className="rounded-lg text-xs shadow-none sm:text-sm"
              onClick={() => navigate("/")}
              size="sm"
            >
              <BookOpen className="mr-2 h-4 w-4" />
              Browse Courses
            </Button>
          </div>
        </SurfaceCard>

        <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredApplications.length === 0 ? (
            <EmptyState
              activeTab={activeTabDefinition}
              onBrowse={() =>
                navigate(
                  currentApplication
                    ? "/review"
                    : hasProfile
                      ? "/overview"
                      : "/applicant-profile?redirect=/overview",
                )
              }
              onBrowseLabel={
                currentApplication
                  ? "View Current Application"
                  : hasProfile
                    ? "Start Application"
                    : "Create Applicant Profile"
              }
            />
          ) : (
            filteredApplications.map((application) => (
              <ApplicationCard
                key={application.id}
                  application={application}
                  selectedCourse={selectedCourse}
                  onEdit={() => navigate("/overview")}
                onResume={() => navigate(nextPath)}
                onViewApplication={() =>
                  navigate(application.status === "submitted" ? "/submitted" : "/review")
                }
                onViewCourse={() => navigate("/")}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
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
  tone: "orange" | "blue" | "green" | "red";
  onClick: () => void;
}) {
  const tones = {
    orange: active
      ? "border-orange-500 ring-2 ring-orange-200"
      : "border-gray-200 hover:border-orange-300",
    blue: active
      ? "border-blue-500 ring-2 ring-blue-200"
      : "border-gray-200 hover:border-blue-300",
    green: active
      ? "border-green-500 ring-2 ring-green-200"
      : "border-gray-200 hover:border-green-300",
    red: active
      ? "border-red-500 ring-2 ring-red-200"
      : "border-gray-200 hover:border-red-300",
  };

  const iconTones = {
    orange: active ? "bg-orange-500 text-white" : "bg-orange-100 text-orange-600",
    blue: active ? "bg-blue-500 text-white" : "bg-blue-100 text-blue-600",
    green: active ? "bg-green-500 text-white" : "bg-green-100 text-green-600",
    red: active ? "bg-red-500 text-white" : "bg-red-100 text-red-600",
  };

  return (
    <button
      className={`rounded-lg border-2 bg-white p-3 text-left shadow-sm transition-all hover:shadow-md sm:p-4 ${tones[tone]}`}
      type="button"
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="mb-0.5 text-xs text-gray-600 sm:mb-1">{label}</p>
          <p className="text-xl font-bold text-gray-900 sm:text-2xl">{count}</p>
        </div>
        <div className={`rounded-full p-2 sm:p-3 ${iconTones[tone]}`}>{icon}</div>
      </div>
    </button>
  );
}

function ApplicationCard({
  application,
  selectedCourse,
  onViewCourse,
  onEdit,
  onViewApplication,
  onResume,
}: {
  application: ApplicationCardData;
  selectedCourse: ReturnType<typeof getSelectedCourse>;
  onViewCourse: () => void;
  onEdit: () => void;
  onViewApplication: () => void;
  onResume: () => void;
}) {
  return (
    <SurfaceCard className="flex flex-col overflow-hidden rounded-[28px]">
      <div className="relative">
        <img
          alt={application.title}
          className="h-40 w-full object-cover"
          src={selectedCourse.image}
        />
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="mb-3 text-base font-bold text-gray-900">{application.title}</h3>

        <div className="mb-3 space-y-1 text-sm">
          <DetailRow label="Delivery" value={selectedCourse.delivery} />
          <DetailRow label="Duration" value={selectedCourse.duration} />
          <DetailRow label="Total Price" value={selectedCourse.price} />
          <DetailRow label="Intake" value={application.intake} />
        </div>

        <div className="mb-3">{getStatusBadge(application)}</div>

        {application.status === "submitted" ? (
          <div className="mb-4 space-y-1 text-xs text-gray-600">
            <p>Submitted {application.submittedDate}</p>
            {application.applicationNumber ? (
              <p>Application Number: {application.applicationNumber}</p>
            ) : null}
          </div>
        ) : (
          <div className="mb-4 text-xs text-gray-600">
            <p>
              Next step: {application.nextStep ?? "Review and submit"}
            </p>
          </div>
        )}

        <div className="mt-auto space-y-2">
          <Button
            className="w-full justify-center rounded-lg shadow-none"
            size="sm"
            variant="neutralOutline"
            onClick={onViewCourse}
          >
            <Eye className="mr-2 h-4 w-4" />
            View Course
          </Button>

          {application.status === "in-progress" ? (
            <Button
              className="w-full justify-center rounded-lg shadow-none"
              size="sm"
              variant="outline"
              onClick={onEdit}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit Application
            </Button>
          ) : null}

          <Button
            className="w-full justify-center rounded-lg shadow-none"
            size="sm"
            variant="outline"
            onClick={onViewApplication}
          >
            <FileText className="mr-2 h-4 w-4" />
            {application.status === "submitted"
              ? "View Submitted Application"
              : "View Application"}
          </Button>

          <DashboardPrimaryActionButton
            action={getDashboardPrimaryAction(application, {
              onResume,
            })}
          />
        </div>
      </div>
    </SurfaceCard>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start">
      <span className="mr-1 text-gray-600">●</span>
      <span className="text-gray-600">{label}:</span>
      <span className="ml-1">{value}</span>
    </div>
  );
}

function EmptyState({
  activeTab,
  onBrowse,
  onBrowseLabel,
}: {
  activeTab: DashboardPanelDefinition;
  onBrowse: () => void;
  onBrowseLabel: string;
}) {
  return (
    <SurfaceCard className="col-span-full p-12 text-center">
      <div className="mx-auto max-w-md">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          {activeTab.icon}
        </div>
        <h3 className="mb-2 text-lg font-semibold text-gray-900">{activeTab.emptyTitle}</h3>
        <p className="mb-6 text-sm text-gray-600">{activeTab.emptyBody}</p>
        <Button className="rounded-lg shadow-none" onClick={onBrowse}>
          <BookOpen className="mr-2 h-4 w-4" />
          {onBrowseLabel}
        </Button>
      </div>
    </SurfaceCard>
  );
}

function getStatusBadge(application: ApplicationCardData) {
  if (application.status === "submitted") {
    return (
      <StatusPill icon={<CheckCircle2 className="h-4 w-4" />} tone="info">
        Submitted
      </StatusPill>
    );
  }

  return (
    <StatusPill icon={<Clock className="h-4 w-4" />} tone="warning">
      In progress
    </StatusPill>
  );
}

function DashboardPrimaryActionButton({
  action,
}: {
  action: DashboardPrimaryAction;
}) {
  return (
    <Button
      className="w-full rounded-lg shadow-none"
      disabled={action.disabled}
      variant={action.variant}
      onClick={action.onClick}
    >
      {action.label}
    </Button>
  );
}

function getDashboardPrimaryAction(
  application: ApplicationCardData,
  handlers: {
    onResume: () => void;
  },
): DashboardPrimaryAction {
  if (application.status === "submitted") {
    return {
      disabled: true,
      label: "Submitted",
      variant: "soft",
    };
  }

  return {
    label: "Resume Application",
    onClick: handlers.onResume,
    variant: "default",
  };
}

function getDashboardResumePath(nextSection: string | null, hasProfile: boolean) {
  if (!hasProfile) return "/applicant-profile?redirect=/overview";

  if (!nextSection) return "/review";

  const pathMap: Record<string, string> = {
    "Basic information": "/section1/basic-info",
    "Personal contact details": "/section1/personal-contact",
    "Citizenship information": "/section1/contact-info",
    "Address details": "/section1/address",
    "Tertiary qualifications": "/section2/qualifications",
    "CV upload": "/section2/add-cv",
    "Employment experience": "/section2/add-employment",
  };

  return pathMap[nextSection] ?? "/overview";
}
