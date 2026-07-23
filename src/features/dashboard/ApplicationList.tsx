import { CheckCircle2, Clock } from "lucide-react";
import { StatusPill } from "../../components/StatusPill";
import { SurfaceCard } from "../../components/SurfaceCard";
import { Button } from "../../components/ui/button";
import type { ApplicationSummary } from "../../lib/applicationRecords";
import { formatApplicationDate, getSelectedCourse } from "../../lib/applicationProgress";
import type { DashboardTabDefinition } from "./DashboardTabs";

interface ApplicationListProps {
  activeApplicationId?: string | null;
  activeTabDefinition: DashboardTabDefinition;
  applications: ApplicationSummary[];
  onBrowseCourses: () => void;
  onOpenApplication: (application: ApplicationSummary) => void | Promise<void>;
  onViewCourse: (application: ApplicationSummary) => void;
}

export function ApplicationList({
  activeApplicationId,
  activeTabDefinition,
  applications,
  onBrowseCourses,
  onOpenApplication,
  onViewCourse,
}: ApplicationListProps) {
  if (applications.length === 0) {
    return (
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
          <Button className="mt-6" onClick={onBrowseCourses}>
            View courses
          </Button>
        </div>
      </SurfaceCard>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {applications.map((application) => (
        <ApplicationRow
          key={application.id}
          application={application}
          isActive={application.id === activeApplicationId}
          onOpen={() => void onOpenApplication(application)}
          onViewCourse={() => onViewCourse(application)}
        />
      ))}
    </div>
  );
}

function ApplicationRow({
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
        <ApplicationMeta label="Delivery" value={selectedCourse.delivery || "Not set"} />
        <ApplicationMeta label="Intake" value={application.course.intake} />
        <ApplicationMeta
          label="Updated"
          value={formatApplicationDate(application.updatedAt) || "Today"}
        />
        <ApplicationMeta
          label="Application #"
          value={application.applicationNumber ?? "Pending"}
        />
      </div>

      {isActive ? (
        <div className="content-block-compact mt-5 rounded-2xl border border-[var(--info-border)] bg-[var(--info-bg)] px-4 py-3 text-sm font-medium text-[var(--info-text)]">
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

function ApplicationMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="content-block-compact rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <span className="block text-xs uppercase tracking-[0.16em] text-slate-500">
        {label}
      </span>
      <span className="mt-1 block font-medium text-slate-900">{value}</span>
    </div>
  );
}
