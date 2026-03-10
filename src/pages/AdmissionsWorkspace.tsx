import {
  ArrowRight,
  ClipboardList,
  Eye,
  Search,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AppBrandHeader } from "../components/AppBrandHeader";
import { StatusPill } from "../components/StatusPill";
import { SurfaceCard } from "../components/SurfaceCard";
import { Button } from "../components/ui/button";
import { useAuth } from "../context/AuthContext";
import {
  assignAdmissionsRecord,
  loadAdmissionsWorkspaceRecords,
  saveAdmissionsWorkspaceRecords,
  type AdmissionsQueueRecord,
  type AdmissionsQueueStatus,
} from "../lib/admissionsWorkspace";
import { capturePostHogEvent } from "../lib/posthog";

type StatusFilter = "all" | AdmissionsQueueStatus;
type AssigneeFilter = "all" | "mine" | "unassigned";

function formatTimestamp(value: string | undefined): string {
  if (!value) {
    return "Not yet";
  }

  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getApplicantName(record: AdmissionsQueueRecord): string {
  return [
    record.application.personalDetails.firstName,
    record.application.personalDetails.lastName,
  ]
    .filter(Boolean)
    .join(" ");
}

function getStatusTone(status: AdmissionsQueueStatus) {
  switch (status) {
    case "new":
      return "warning" as const;
    case "assigned":
      return "info" as const;
    case "under-review":
      return "info" as const;
    case "ready-for-decision":
      return "success" as const;
  }
}

function useAdmissionsWorkspaceRecords() {
  const [records, setRecords] = useState<AdmissionsQueueRecord[]>(() =>
    loadAdmissionsWorkspaceRecords(),
  );

  const updateRecords = (
    updater: (current: AdmissionsQueueRecord[]) => AdmissionsQueueRecord[],
  ) => {
    setRecords((current) => {
      const next = updater(current);
      saveAdmissionsWorkspaceRecords(next);
      return next;
    });
  };

  return {
    records,
    updateRecords,
  };
}

const statusFilterOptions: Array<{ label: string; value: StatusFilter }> = [
  { label: "All statuses", value: "all" },
  { label: "New", value: "new" },
  { label: "Assigned", value: "assigned" },
  { label: "Under review", value: "under-review" },
  { label: "Ready for decision", value: "ready-for-decision" },
];

const assigneeFilterOptions: Array<{ label: string; value: AssigneeFilter }> = [
  { label: "All assignments", value: "all" },
  { label: "Assigned to me", value: "mine" },
  { label: "Unassigned", value: "unassigned" },
];

export default function AdmissionsWorkspace() {
  const navigate = useNavigate();
  const { companyUserDisplayName, companyUserEmail } = useAuth();
  const actor = companyUserEmail ?? "admissions.user@keypath.com.au";
  const { records, updateRecords } = useAdmissionsWorkspaceRecords();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredRecords = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return records.filter((record) => {
      if (statusFilter !== "all" && record.status !== statusFilter) {
        return false;
      }

      if (assigneeFilter === "mine" && record.assignee !== actor) {
        return false;
      }

      if (assigneeFilter === "unassigned" && record.assignee) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        getApplicantName(record),
        record.application.personalDetails.email,
        record.application.selectedCourse.providerName,
        record.application.selectedCourse.courseTitle,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [actor, assigneeFilter, records, searchQuery, statusFilter]);

  const metrics = useMemo(
    () => ({
      total: records.length,
      unassigned: records.filter((record) => !record.assignee).length,
      underReview: records.filter((record) => record.status === "under-review").length,
      ready: records.filter((record) => record.status === "ready-for-decision").length,
    }),
    [records],
  );

  return (
    <div className="min-h-screen bg-[#f7f7f4]">
      <AppBrandHeader>
        <Button onClick={() => navigate("/dashboard")} variant="outline">
          Applicant dashboard
        </Button>
      </AppBrandHeader>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-bold text-slate-950 sm:text-4xl">
              Admissions workspace
            </h1>
            <p className="mt-3 text-base leading-7 text-slate-600">
              Review queue assignment, applicant evidence, and operational handover
              notes without leaving the platform. Signed in as {companyUserDisplayName}.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => navigate("/")} variant="outline">
              Browse courses
            </Button>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={<ClipboardList className="h-5 w-5" />}
            label="Queue total"
            value={metrics.total}
          />
          <MetricCard
            icon={<Users className="h-5 w-5" />}
            label="Unassigned"
            value={metrics.unassigned}
          />
          <MetricCard
            icon={<Eye className="h-5 w-5" />}
            label="Under review"
            value={metrics.underReview}
          />
          <MetricCard
            icon={<UserRoundCheck className="h-5 w-5" />}
            label="Ready for decision"
            value={metrics.ready}
          />
        </div>

        <SurfaceCard className="mt-8 rounded-[32px] p-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_220px_220px]">
            <label className="flex items-center gap-3 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3">
              <Search className="h-4 w-4 text-slate-500" />
              <input
                className="w-full border-none bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search applicant, provider, or course"
                value={searchQuery}
              />
            </label>
            <select
              className="rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              value={statusFilter}
            >
              {statusFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              className="rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
              onChange={(event) => setAssigneeFilter(event.target.value as AssigneeFilter)}
              value={assigneeFilter}
            >
              {assigneeFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </SurfaceCard>

        {filteredRecords.length === 0 ? (
          <SurfaceCard className="mt-6 rounded-[32px] p-10 text-center">
            <h2 className="text-2xl font-bold text-slate-950">No queue matches</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Try changing your filters or clearing the search query.
            </p>
          </SurfaceCard>
        ) : (
          <div className="mt-6 grid gap-5">
            {filteredRecords.map((record) => {
              const applicantName = getApplicantName(record);
              const isAssignedToMe = record.assignee === actor;

              return (
                <SurfaceCard
                  key={record.applicationId}
                  className="rounded-[32px] border border-slate-200 p-6"
                >
                  <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <StatusPill tone={getStatusTone(record.status)}>
                          {record.status.replaceAll("-", " ")}
                        </StatusPill>
                        <StatusPill tone={record.priority === "high" ? "warning" : "neutral"}>
                          {record.priority} priority
                        </StatusPill>
                      </div>
                      <h2 className="mt-4 text-2xl font-bold text-slate-950">
                        {applicantName}
                      </h2>
                      <p className="mt-1 text-sm text-slate-600">
                        {record.application.personalDetails.email}
                      </p>
                      <div className="mt-5 grid gap-3 text-sm text-slate-700 sm:grid-cols-2 xl:grid-cols-4">
                        <QueueMeta
                          label="Provider"
                          value={record.application.selectedCourse.providerName}
                        />
                        <QueueMeta
                          label="Course"
                          value={record.application.selectedCourse.courseTitle}
                        />
                        <QueueMeta
                          label="Submitted"
                          value={formatTimestamp(record.application.submittedAt)}
                        />
                        <QueueMeta
                          label="Documents"
                          value={String(record.application.documents.length)}
                        />
                      </div>
                    </div>

                    <div className="w-full max-w-sm shrink-0 rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Assignment and activity
                      </p>
                      <dl className="mt-4 grid gap-3 text-sm text-slate-700">
                        <div>
                          <dt className="text-slate-500">Assignee</dt>
                          <dd className="mt-1 font-medium text-slate-950">
                            {record.assignee ?? "Unassigned"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Last activity</dt>
                          <dd className="mt-1 font-medium text-slate-950">
                            {formatTimestamp(record.lastActivityAt)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Notes</dt>
                          <dd className="mt-1 font-medium text-slate-950">
                            {record.notes.length}
                          </dd>
                        </div>
                      </dl>
                      <div className="mt-5 flex flex-col gap-3">
                        <Button
                          onClick={() => {
                            capturePostHogEvent("admissions_queue_review_opened", {
                              admissions_application_id: record.applicationId,
                              admissions_status: record.status,
                              admissions_assignee: record.assignee ?? null,
                            });
                            navigate(`/admissions/applications/${record.applicationId}`);
                          }}
                        >
                          Open review workspace
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() => {
                            updateRecords((current) =>
                              assignAdmissionsRecord(current, {
                                actor,
                                applicationId: record.applicationId,
                                assignee: isAssignedToMe ? undefined : actor,
                              }),
                            );
                            capturePostHogEvent("admissions_queue_assignment_updated", {
                              admissions_application_id: record.applicationId,
                              admissions_assignment_action: isAssignedToMe
                                ? "cleared"
                                : "assigned_to_me",
                            });
                          }}
                          variant="outline"
                        >
                          {isAssignedToMe ? "Clear assignment" : "Assign to me"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </SurfaceCard>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <SurfaceCard className="rounded-[28px] p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
        </div>
        <div className="rounded-full bg-slate-100 p-3 text-slate-600">{icon}</div>
      </div>
    </SurfaceCard>
  );
}

function QueueMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <span className="block text-xs uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>
      <span className="mt-1 block font-medium text-slate-900">{value}</span>
    </div>
  );
}
