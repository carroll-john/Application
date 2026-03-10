import {
  ArrowRight,
  ClipboardList,
  Eye,
  ChevronLeft,
  ChevronRight,
  Search,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppBrandHeader } from "../components/AppBrandHeader";
import { StatusPill } from "../components/StatusPill";
import { SurfaceCard } from "../components/SurfaceCard";
import { Button } from "../components/ui/button";
import { useAuth } from "../context/AuthContext";
import {
  ADMISSIONS_QUEUE_PAGE_SIZE,
  assignAdmissionsRecord,
  buildAdmissionsQueueSearchParams,
  filterAdmissionsQueueRecords,
  getAdmissionsQueueCourseLineOptions,
  getAdmissionsQueuePartnerOptions,
  loadAdmissionsWorkspaceRecords,
  paginateAdmissionsQueueRecords,
  readAdmissionsQueueSearchState,
  saveAdmissionsWorkspaceRecords,
  type AdmissionsAssigneeFilter,
  type AdmissionsQueueRecord,
  type AdmissionsQueueStatus,
  type AdmissionsStatusFilter,
} from "../lib/admissionsWorkspace";
import {
  getPartnerCourseRolloutModeDefinition,
  getPartnerCourseRolloutSnapshot,
  loadPartnerCourseRolloutConfigs,
  savePartnerCourseRolloutConfigs,
  transitionPartnerCourseRolloutMode,
  type PartnerCourseRolloutConfig,
  type PartnerCourseRolloutMode,
} from "../lib/partnerCourseRollout";
import {
  captureAdmissionsPilotTelemetryEvent,
  captureRolloutModePilotTelemetryEvent,
} from "../lib/pilotTelemetry";

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
    case "decisioned":
      return "neutral" as const;
    case "provisioning":
      return "info" as const;
    case "provisioned":
      return "success" as const;
    case "provisioning-exception":
      return "warning" as const;
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

function usePartnerCourseRolloutConfigs() {
  const [rolloutConfigs, setRolloutConfigs] = useState<PartnerCourseRolloutConfig[]>(() =>
    loadPartnerCourseRolloutConfigs(),
  );

  const updateRolloutConfigs = (nextConfigs: PartnerCourseRolloutConfig[]) => {
    setRolloutConfigs(nextConfigs);
    savePartnerCourseRolloutConfigs(nextConfigs);
  };

  return {
    rolloutConfigs,
    updateRolloutConfigs,
  };
}

const statusFilterOptions: Array<{ label: string; value: AdmissionsStatusFilter }> = [
  { label: "All statuses", value: "all" },
  { label: "New", value: "new" },
  { label: "Assigned", value: "assigned" },
  { label: "Under review", value: "under-review" },
  { label: "Ready for decision", value: "ready-for-decision" },
  { label: "Decisioned", value: "decisioned" },
  { label: "Provisioning", value: "provisioning" },
  { label: "Provisioned", value: "provisioned" },
  { label: "Provisioning exception", value: "provisioning-exception" },
];

const assigneeFilterOptions: Array<{ label: string; value: AdmissionsAssigneeFilter }> = [
  { label: "All assignments", value: "all" },
  { label: "Assigned to me", value: "mine" },
  { label: "Unassigned", value: "unassigned" },
];

export default function AdmissionsWorkspace() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { companyUserDisplayName, companyUserEmail, signOut } = useAuth();
  const actor = companyUserEmail ?? "admissions.user@keypath.com.au";
  const { records, updateRecords } = useAdmissionsWorkspaceRecords();
  const { rolloutConfigs, updateRolloutConfigs } = usePartnerCourseRolloutConfigs();
  const [rolloutDrafts, setRolloutDrafts] = useState<
    Record<string, { mode: PartnerCourseRolloutMode; reason: string }>
  >({});
  const [rolloutMessages, setRolloutMessages] = useState<
    Record<string, { body: string; tone: "info" | "warning" }>
  >({});
  const searchState = useMemo(
    () => readAdmissionsQueueSearchState(searchParams),
    [searchParams],
  );
  const rolloutConfigRows = useMemo(
    () =>
      [...rolloutConfigs].sort((left, right) =>
        `${left.partnerName}-${left.courseTitle}`.localeCompare(
          `${right.partnerName}-${right.courseTitle}`,
        ),
      ),
    [rolloutConfigs],
  );

  const filteredRecords = useMemo(() => {
    return filterAdmissionsQueueRecords(records, {
      actor,
      searchState,
    });
  }, [actor, records, searchState]);

  const pagination = useMemo(
    () => paginateAdmissionsQueueRecords(filteredRecords, searchState.page),
    [filteredRecords, searchState.page],
  );

  const partnerFilterOptions = useMemo(
    () => [
      { label: "All partners", value: "all" },
      ...getAdmissionsQueuePartnerOptions(records),
    ],
    [records],
  );

  const courseLineFilterOptions = useMemo(
    () => [
      { label: "All course lines", value: "all" },
      ...getAdmissionsQueueCourseLineOptions(records),
    ],
    [records],
  );

  useEffect(() => {
    if (pagination.page === searchState.page) {
      return;
    }

    setSearchParams(
      buildAdmissionsQueueSearchParams({
        ...searchState,
        page: pagination.page,
      }),
      { replace: true },
    );
  }, [pagination.page, searchState, setSearchParams]);

  const pageNumbers = useMemo(
    () => Array.from({ length: pagination.totalPages }, (_, index) => index + 1),
    [pagination.totalPages],
  );

  const updateSearchState = (
    patch: Partial<typeof searchState>,
    options: { resetPage?: boolean } = {},
  ) => {
    const nextState = {
      ...searchState,
      ...patch,
      page: options.resetPage === false ? patch.page ?? searchState.page : 1,
    };
    setSearchParams(buildAdmissionsQueueSearchParams(nextState), {
      replace: true,
    });
  };

  const metrics = useMemo(
    () => ({
      total: records.length,
      unassigned: records.filter((record) => !record.assignee).length,
      underReview: records.filter((record) => record.status === "under-review").length,
      ready: records.filter((record) => record.status === "ready-for-decision").length,
    }),
    [records],
  );

  const getRolloutDraft = (config: PartnerCourseRolloutConfig) =>
    rolloutDrafts[config.configId] ?? {
      mode: config.activeMode,
      reason: "",
    };

  const setRolloutDraft = (
    configId: string,
    patch: Partial<{ mode: PartnerCourseRolloutMode; reason: string }>,
  ) => {
    const activeMode =
      rolloutConfigRows.find((config) => config.configId === configId)?.activeMode ??
      "mode-1-review-only";
    setRolloutDrafts((current) => ({
      ...current,
      [configId]: {
        ...(current[configId] ?? { mode: activeMode, reason: "" }),
        ...patch,
      },
    }));
  };

  const applyRolloutModeChange = (config: PartnerCourseRolloutConfig) => {
    const draft = getRolloutDraft(config);
    const previousMode = config.activeMode;
    const result = transitionPartnerCourseRolloutMode(rolloutConfigs, {
      actor,
      courseCode: config.courseCode,
      courseTitle: config.courseTitle,
      nextMode: draft.mode,
      partnerId: config.partnerId,
      partnerName: config.partnerName,
      reason: draft.reason,
    });

    updateRolloutConfigs(result.configs);
    setRolloutMessages((current) => ({
      ...current,
      [config.configId]: {
        body: result.valid
          ? `${getPartnerCourseRolloutModeDefinition(draft.mode).label} is now active for ${config.partnerName} ${config.courseCode}.`
          : result.validationErrors.join(" "),
        tone: result.valid ? "info" : "warning",
      },
    }));

    if (result.valid) {
      setRolloutDrafts((current) => ({
        ...current,
        [config.configId]: {
          mode: draft.mode,
          reason: "",
        },
      }));
    }

    captureRolloutModePilotTelemetryEvent({
      actor,
      config,
      nextMode: draft.mode,
      outcome: result.valid ? "applied" : "rejected",
      previousMode,
      reason: draft.reason,
    });
  };

  return (
    <div className="min-h-screen bg-[#f7f7f4]">
      <AppBrandHeader variant="admissions">
        <Button
          onClick={async () => {
            await signOut();
            navigate("/sign-in", { replace: true });
          }}
          variant="outline"
        >
          Log out
        </Button>
      </AppBrandHeader>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-bold text-slate-950 sm:text-4xl">
            Admissions workspace
          </h1>
          <p className="mt-3 text-base leading-7 text-slate-600">
            Review queue assignment, applicant evidence, and operational handover
            notes without leaving the portal. Signed in as {companyUserDisplayName}.
          </p>
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
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Rollout registry
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">
                Partner-course coexistence modes
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Change pilot course lines between review-only, decision plus export,
                and automated provisioning without touching code. Every change is
                logged with actor, timestamp, and reason.
              </p>
            </div>
            <p className="text-sm text-slate-500">
              Changes persist locally in the demo environment.
            </p>
          </div>
          <div className="mt-6 grid gap-4 xl:grid-cols-3">
            {rolloutConfigRows.map((config) => {
              const definition = getPartnerCourseRolloutModeDefinition(config.activeMode);
              const draft = getRolloutDraft(config);
              const latestTransition = config.transitions.at(-1);
              const message = rolloutMessages[config.configId];

              return (
                <div
                  key={config.configId}
                  className="rounded-[28px] border border-slate-200 bg-slate-50 p-5"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusPill tone={definition.tone}>{definition.shortLabel}</StatusPill>
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                      {config.partnerId} · {config.courseCode}
                    </p>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-950">
                    {config.partnerName}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">{config.courseTitle}</p>
                  <p className="mt-4 text-sm leading-6 text-slate-700">
                    {definition.operatorSummary}
                  </p>
                  <p className="mt-4 text-xs uppercase tracking-[0.14em] text-slate-500">
                    Updated {formatTimestamp(config.updatedAt)} by {config.updatedBy}
                  </p>
                  {latestTransition ? (
                    <div
                      className={`mt-4 rounded-[20px] border px-4 py-3 text-sm ${
                        latestTransition.outcome === "applied"
                          ? "border-slate-200 bg-white text-slate-700"
                          : "border-amber-200 bg-amber-50 text-amber-900"
                      }`}
                    >
                      <p className="font-medium text-slate-950">{latestTransition.reason}</p>
                      {latestTransition.validationErrors?.length ? (
                        <p className="mt-1 leading-6">
                          {latestTransition.validationErrors.join(" ")}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {message ? (
                    <div
                      className={`mt-4 rounded-[20px] border px-4 py-3 text-sm ${
                        message.tone === "warning"
                          ? "border-amber-200 bg-amber-50 text-amber-900"
                          : "border-emerald-200 bg-emerald-50 text-emerald-900"
                      }`}
                    >
                      {message.body}
                    </div>
                  ) : null}
                  <div className="mt-4 grid gap-3">
                    <select
                      className="rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                      onChange={(event) =>
                        setRolloutDraft(config.configId, {
                          mode: event.target.value as PartnerCourseRolloutMode,
                        })
                      }
                      value={draft.mode}
                    >
                      <option value="mode-1-review-only">Mode 1 · Review only</option>
                      <option value="mode-2-decision-export">
                        Mode 2 · Decision and export
                      </option>
                      <option value="mode-3-automated-provisioning">
                        Mode 3 · Automated provisioning
                      </option>
                    </select>
                    <textarea
                      className="min-h-24 rounded-[24px] border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#0B4F74]"
                      onChange={(event) =>
                        setRolloutDraft(config.configId, {
                          reason: event.target.value,
                        })
                      }
                      placeholder="Reason for changing the rollout mode"
                      value={draft.reason}
                    />
                    <Button
                      onClick={() => applyRolloutModeChange(config)}
                      variant="outline"
                    >
                      Apply rollout mode
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </SurfaceCard>

        <SurfaceCard className="mt-8 rounded-[32px] p-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,190px))]">
            <label className="flex items-center gap-3 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3">
              <Search className="h-4 w-4 text-slate-500" />
              <input
                className="w-full border-none bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                onChange={(event) =>
                  updateSearchState({
                    query: event.target.value,
                  })
                }
                placeholder="Search applicant, email, application ID, provider, or course"
                value={searchState.query}
              />
            </label>
            <select
              className="rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
              onChange={(event) =>
                updateSearchState({
                  status: event.target.value as AdmissionsStatusFilter,
                })
              }
              value={searchState.status}
            >
              {statusFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              className="rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
              onChange={(event) =>
                updateSearchState({
                  assignee: event.target.value as AdmissionsAssigneeFilter,
                })
              }
              value={searchState.assignee}
            >
              {assigneeFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              className="rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
              onChange={(event) =>
                updateSearchState({
                  partner: event.target.value,
                })
              }
              value={searchState.partner}
            >
              {partnerFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              className="rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
              onChange={(event) =>
                updateSearchState({
                  courseLine: event.target.value,
                })
              }
              value={searchState.courseLine}
            >
              {courseLineFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-4 flex flex-col gap-2 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
            <p>
              Showing {pagination.startRecord}-{pagination.endRecord} of{" "}
              {pagination.totalRecords} applications. Page {pagination.page} of{" "}
              {pagination.totalPages}. Page size {ADMISSIONS_QUEUE_PAGE_SIZE}.
            </p>
            <p>Queue filters and search state are preserved in the URL.</p>
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
            {pagination.records.map((record) => {
              const applicantName = getApplicantName(record);
              const isAssignedToMe = record.assignee === actor;
              const rolloutSnapshot = getPartnerCourseRolloutSnapshot(
                record.application,
                rolloutConfigs,
              );
              const rolloutDefinition = getPartnerCourseRolloutModeDefinition(
                rolloutSnapshot.mode,
              );

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
                        <StatusPill tone={rolloutDefinition.tone}>
                          {rolloutDefinition.shortLabel}
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
                          <dt className="text-slate-500">Rollout mode</dt>
                          <dd className="mt-1 font-medium text-slate-950">
                            {rolloutDefinition.label}
                          </dd>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {rolloutDefinition.operatorSummary}
                          </p>
                        </div>
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
                            captureAdmissionsPilotTelemetryEvent(
                              "admissions_queue_review_opened",
                              {
                                actor,
                                record,
                                rolloutMode: rolloutSnapshot.mode,
                              },
                            );
                            navigate(`/admissions/applications/${record.applicationId}`);
                          }}
                        >
                          Open review workspace
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() => {
                            const nextRecords = assignAdmissionsRecord(records, {
                              actor,
                              applicationId: record.applicationId,
                              assignee: isAssignedToMe ? undefined : actor,
                            });
                            const nextRecord =
                              nextRecords.find(
                                (candidate) =>
                                  candidate.applicationId === record.applicationId,
                              ) ?? record;

                            updateRecords(() => nextRecords);
                            captureAdmissionsPilotTelemetryEvent(
                              "admissions_queue_assignment_updated",
                              {
                                actor,
                                properties: {
                                  pilot_assignment_action: isAssignedToMe
                                    ? "cleared"
                                    : "assigned_to_me",
                                },
                                record: nextRecord,
                                rolloutMode: rolloutSnapshot.mode,
                              },
                            );
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

            {pagination.totalPages > 1 ? (
              <SurfaceCard className="rounded-[28px] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-600">
                    Result window {pagination.startRecord}-{pagination.endRecord} of{" "}
                    {pagination.totalRecords}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      disabled={pagination.page === 1}
                      onClick={() =>
                        updateSearchState(
                          {
                            page: pagination.page - 1,
                          },
                          { resetPage: false },
                        )
                      }
                      variant="outline"
                    >
                      <ChevronLeft className="mr-2 h-4 w-4" />
                      Previous
                    </Button>
                    {pageNumbers.map((pageNumber) => (
                      <Button
                        key={pageNumber}
                        onClick={() =>
                          updateSearchState(
                            {
                              page: pageNumber,
                            },
                            { resetPage: false },
                          )
                        }
                        variant={pageNumber === pagination.page ? "default" : "outline"}
                      >
                        {pageNumber}
                      </Button>
                    ))}
                    <Button
                      disabled={pagination.page === pagination.totalPages}
                      onClick={() =>
                        updateSearchState(
                          {
                            page: pagination.page + 1,
                          },
                          { resetPage: false },
                        )
                      }
                      variant="outline"
                    >
                      Next
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </SurfaceCard>
            ) : null}
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
