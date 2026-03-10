import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Mail,
  Phone,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppBrandHeader } from "../components/AppBrandHeader";
import { ModalShell } from "../components/ModalShell";
import { StatusPill } from "../components/StatusPill";
import { SurfaceCard } from "../components/SurfaceCard";
import { Button } from "../components/ui/button";
import { useAuth } from "../context/AuthContext";
import type { CanonicalDocumentReference } from "../integrationPlatform/contracts";
import {
  addAdmissionsNote,
  assignAdmissionsRecord,
  buildAdmissionsDocumentPreview,
  evaluateAdmissionsDocumentAccess,
  findAdmissionsRecord,
  loadAdmissionsWorkspaceRecords,
  requestAdmissionsDocumentAccess,
  saveAdmissionsWorkspaceRecords,
  updateAdmissionsStatus,
  type AdmissionsQueueRecord,
  type AdmissionsQueueStatus,
} from "../lib/admissionsWorkspace";
import {
  captureAdmissionsDecision,
  evaluateAdmissionsDecisionReadiness,
  formatAdmissionsDecisionOutcome,
  getAdmissionsDecisionReasonLabel,
  getAdmissionsDecisionReasonOptions,
  getLatestAdmissionsDecision,
  getLatestAdmissionsPortalRpaDriftSignal,
  getLatestAdmissionsPortalRpaRun,
  getLatestAdmissionsProvisioningJob,
  getLatestAdmissionsReconciliation,
  getLatestAdmissionsStructuredExport,
  getOpenAdmissionsException,
  listAdmissionsPortalRpaEvidence,
  listAdmissionsProvisioningAuditEvents,
  type AdmissionsDecisionOutcome,
} from "../lib/admissionsDecisioning";
import {
  getPartnerCourseRolloutModeDefinition,
  getPartnerCourseRolloutSnapshot,
  loadPartnerCourseRolloutConfigs,
} from "../lib/partnerCourseRollout";
import { capturePostHogEvent } from "../lib/posthog";

function formatTimestamp(value: string | undefined): string {
  if (!value) {
    return "Not yet";
  }

  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
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

const statusOptions: AdmissionsQueueStatus[] = [
  "new",
  "assigned",
  "under-review",
  "ready-for-decision",
];

export default function AdmissionsApplicationReview() {
  const navigate = useNavigate();
  const { applicationId } = useParams<{ applicationId: string }>();
  const { companyUserDisplayName, companyUserEmail, signOut } = useAuth();
  const actor = companyUserEmail ?? "admissions.user@keypath.com.au";
  const { records, updateRecords } = useAdmissionsWorkspaceRecords();
  const rolloutConfigs = useMemo(() => loadPartnerCourseRolloutConfigs(), []);
  const record = useMemo(
    () => (applicationId ? findAdmissionsRecord(records, applicationId) : undefined),
    [applicationId, records],
  );
  const [noteDraft, setNoteDraft] = useState("");
  const [activeDocumentSession, setActiveDocumentSession] = useState<{
    accessedAt: string;
    document: CanonicalDocumentReference;
  } | null>(null);
  const [documentAccessMessage, setDocumentAccessMessage] = useState<{
    body: string;
    tone: "info" | "warning";
  } | null>(null);
  const [decisionOutcome, setDecisionOutcome] =
    useState<AdmissionsDecisionOutcome>("admit");
  const [decisionReasonCode, setDecisionReasonCode] = useState(
    getAdmissionsDecisionReasonOptions("admit")[0]?.value ?? "",
  );
  const [decisionNotes, setDecisionNotes] = useState("");
  const [decisionMessage, setDecisionMessage] = useState<{
    body: string;
    tone: "info" | "warning";
  } | null>(null);
  const [isCapturingDecision, setIsCapturingDecision] = useState(false);

  if (!record) {
    return (
      <div className="min-h-screen bg-[#f7f7f4]">
        <AppBrandHeader variant="admissions">
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => navigate("/admissions")} variant="outline">
              Back to queue
            </Button>
            <Button
              onClick={async () => {
                await signOut();
                navigate("/sign-in", { replace: true });
              }}
              variant="outline"
            >
              Log out
            </Button>
          </div>
        </AppBrandHeader>
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
          <SurfaceCard className="rounded-[32px] p-10 text-center">
            <h1 className="text-3xl font-bold text-slate-950">Review record not found</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              This admissions item is no longer available in the local review queue.
            </p>
            <Button className="mt-6" onClick={() => navigate("/admissions")}>
              Return to admissions workspace
            </Button>
          </SurfaceCard>
        </div>
      </div>
    );
  }

  const applicantName = [
    record.application.personalDetails.firstName,
    record.application.personalDetails.lastName,
  ]
    .filter(Boolean)
    .join(" ");
  const rolloutSnapshot = getPartnerCourseRolloutSnapshot(
    record.application,
    rolloutConfigs,
  );
  const rolloutDefinition = getPartnerCourseRolloutModeDefinition(rolloutSnapshot.mode);
  const documentAccessPolicy = evaluateAdmissionsDocumentAccess(record, actor);
  const decisionReadiness = evaluateAdmissionsDecisionReadiness(
    record,
    actor,
    rolloutConfigs,
  );
  const reasonOptions = useMemo(
    () => getAdmissionsDecisionReasonOptions(decisionOutcome),
    [decisionOutcome],
  );
  const latestDecision = useMemo(() => getLatestAdmissionsDecision(record), [record]);
  const latestExportArtifact = useMemo(
    () => getLatestAdmissionsStructuredExport(record),
    [record],
  );
  const latestProvisioningJob = useMemo(
    () => getLatestAdmissionsProvisioningJob(record),
    [record],
  );
  const latestPortalRpaRun = useMemo(
    () => getLatestAdmissionsPortalRpaRun(record, latestProvisioningJob?.jobId),
    [latestProvisioningJob?.jobId, record],
  );
  const latestPortalRpaDriftSignal = useMemo(
    () => getLatestAdmissionsPortalRpaDriftSignal(record, latestProvisioningJob?.jobId),
    [latestProvisioningJob?.jobId, record],
  );
  const portalRpaEvidence = useMemo(
    () => listAdmissionsPortalRpaEvidence(record, latestProvisioningJob?.jobId),
    [latestProvisioningJob?.jobId, record],
  );
  const latestReconciliation = useMemo(
    () =>
      getLatestAdmissionsReconciliation(record, latestProvisioningJob?.jobId),
    [latestProvisioningJob?.jobId, record],
  );
  const openException = useMemo(
    () => getOpenAdmissionsException(record, latestProvisioningJob?.jobId),
    [latestProvisioningJob?.jobId, record],
  );
  const provisioningEvents = useMemo(
    () => listAdmissionsProvisioningAuditEvents(record, latestProvisioningJob?.jobId),
    [latestProvisioningJob?.jobId, record],
  );
  const isWorkflowLocked = Boolean(latestDecision);

  useEffect(() => {
    if (reasonOptions.some((option) => option.value === decisionReasonCode)) {
      return;
    }

    setDecisionReasonCode(reasonOptions[0]?.value ?? "");
  }, [decisionReasonCode, reasonOptions]);

  const previewMarkup = activeDocumentSession
    ? buildAdmissionsDocumentPreview(record, activeDocumentSession.document, {
        actor,
        accessedAt: activeDocumentSession.accessedAt,
      })
    : "";

  const handleCaptureDecision = async () => {
    try {
      setIsCapturingDecision(true);
      setDecisionMessage(null);

      const result = await captureAdmissionsDecision(records, {
        actor,
        applicationId: record.applicationId,
        notes: decisionNotes,
        outcome: decisionOutcome,
        reasonCode: decisionReasonCode,
        rolloutConfigs,
      });
      const nextRecord = result.records.find(
        (candidate) => candidate.applicationId === record.applicationId,
      );
      const nextJob = nextRecord ? getLatestAdmissionsProvisioningJob(nextRecord) : undefined;
      const nextExport = nextRecord ? getLatestAdmissionsStructuredExport(nextRecord) : undefined;

      updateRecords(() => result.records);
      setDecisionNotes("");
      setDecisionMessage({
        body:
          result.downstreamAction === "automated-provisioning"
            ? `Decision captured and provisioning is now ${nextJob?.status ?? "queued"}.`
            : result.downstreamAction === "export"
              ? `Decision captured and structured export handoff is ready as ${nextExport?.filename ?? "the latest export package"}.`
              : "Decision captured. This outcome does not trigger downstream automation for the active rollout mode.",
        tone: "info",
      });
      capturePostHogEvent("admissions_decision_captured", {
        admissions_application_id: record.applicationId,
        admissions_decision_outcome: decisionOutcome,
        admissions_decision_reason_code: decisionReasonCode,
        admissions_downstream_action: result.downstreamAction,
        admissions_rollout_mode: result.rolloutMode,
        admissions_provisioning_triggered: result.triggeredProvisioning,
        admissions_provisioning_status: nextJob?.status ?? "not-triggered",
      });
    } catch (error) {
      setDecisionMessage({
        body:
          error instanceof Error
            ? error.message
            : "Decision capture could not be completed.",
        tone: "warning",
      });
    } finally {
      setIsCapturingDecision(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f7f4]">
      <AppBrandHeader variant="admissions">
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => navigate("/admissions")} variant="outline">
            Back to queue
          </Button>
          <Button
            onClick={async () => {
              await signOut();
              navigate("/sign-in", { replace: true });
            }}
            variant="outline"
          >
            Log out
          </Button>
        </div>
      </AppBrandHeader>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-4xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0B4F74]">
              Admissions review workspace
            </p>
            <h1 className="mt-3 text-3xl font-bold text-slate-950 sm:text-4xl">
              {applicantName}
            </h1>
            <p className="mt-3 text-base leading-7 text-slate-600">
              Reviewing {record.application.selectedCourse.courseTitle} for
              {" "}
              {record.application.selectedCourse.providerName}. Signed in as
              {" "}
              {companyUserDisplayName}.
            </p>
          </div>
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
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_360px]">
          <div className="grid gap-6">
            <SurfaceCard className="rounded-[32px] p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Applicant summary
                  </p>
                  <h2 className="mt-3 text-2xl font-bold text-slate-950">
                    {applicantName}
                  </h2>
                </div>
                <StatusPill tone="neutral">Protected review</StatusPill>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <DetailCard
                  icon={<Mail className="h-4 w-4" />}
                  label="Email"
                  value={record.application.personalDetails.email}
                />
                <DetailCard
                  icon={<Phone className="h-4 w-4" />}
                  label="Phone"
                  value={record.application.personalDetails.phone || "Not provided"}
                />
                <DetailCard
                  icon={<ShieldCheck className="h-4 w-4" />}
                  label="Status"
                  value={record.application.status}
                />
                <DetailCard
                  icon={<UserRoundCheck className="h-4 w-4" />}
                  label="Submitted"
                  value={formatTimestamp(record.application.submittedAt)}
                />
              </div>
            </SurfaceCard>

            <SurfaceCard className="rounded-[32px] p-6">
              <SectionHeader
                title="Course and pathway"
                body="Use the structured course payload below to validate the downstream provisioning pathway before decisioning."
              />
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <DetailCard label="Provider" value={record.application.selectedCourse.providerName} />
                <DetailCard label="Course code" value={record.application.selectedCourse.courseCode} />
                <DetailCard label="Course title" value={record.application.selectedCourse.courseTitle} />
                <DetailCard label="Intake" value={record.application.selectedCourse.intakeLabel} />
              </div>
            </SurfaceCard>

            <SurfaceCard className="rounded-[32px] p-6">
              <SectionHeader
                title="Qualifications and experience"
                body="Structured evidence stays visible in one review surface so admissions can validate fit without leaving the workspace."
              />
              <div className="mt-6 grid gap-4">
                {record.application.qualifications.map((qualification) => (
                  <EvidenceCard
                    key={qualification.qualificationId}
                    title={qualification.courseName}
                    subtitle={`${qualification.institutionName} | ${qualification.level}`}
                    meta={`Document refs: ${qualification.documentIds.join(", ") || "None"}`}
                  />
                ))}
                {record.application.employmentHistory.map((experience) => (
                  <EvidenceCard
                    key={experience.experienceId}
                    title={experience.title}
                    subtitle={experience.employerName}
                    meta={experience.currentRole ? "Current role" : "Past role"}
                  />
                ))}
                {record.application.languageTests.map((test) => (
                  <EvidenceCard
                    key={test.testId}
                    title={`${test.provider} ${test.testName}`}
                    subtitle={`Overall score ${test.overallScore ?? "pending"}`}
                    meta={`Document refs: ${test.documentIds.join(", ") || "None"}`}
                  />
                ))}
              </div>
            </SurfaceCard>

            <SurfaceCard className="rounded-[32px] p-6">
              <SectionHeader
                title="Documents"
                body="Each document opens in a protected inline preview so reviewers can inspect evidence without exposing raw storage URLs."
              />
              <div
                className={`mt-5 rounded-[24px] border px-4 py-3 text-sm ${
                  documentAccessPolicy.allowed
                    ? "border-[#c6d8e3] bg-[#F2F8FB] text-[#0B4F74]"
                    : "border-amber-200 bg-amber-50 text-amber-900"
                }`}
              >
                {documentAccessPolicy.allowed
                  ? "Protected evidence opens inline only. Raw source links remain hidden and every document view is logged to the admissions audit trail."
                  : documentAccessPolicy.reason}
              </div>
              {documentAccessMessage ? (
                <div
                  className={`mt-4 rounded-[24px] border px-4 py-3 text-sm ${
                    documentAccessMessage.tone === "warning"
                      ? "border-amber-200 bg-amber-50 text-amber-900"
                      : "border-emerald-200 bg-emerald-50 text-emerald-900"
                  }`}
                >
                  {documentAccessMessage.body}
                </div>
              ) : null}
              <div className="mt-6 grid gap-4">
                {record.application.documents.map((document) => (
                  <div
                    key={document.documentId}
                    className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <StatusPill tone="neutral">{document.category}</StatusPill>
                          {document.requiredForSubmission ? (
                            <StatusPill tone="warning">Submission required</StatusPill>
                          ) : null}
                        </div>
                        <h3 className="mt-3 text-lg font-semibold text-slate-950">
                          {document.filename}
                        </h3>
                        <p className="mt-1 text-sm text-slate-600">
                          {document.contentType} | {formatFileSize(document.sizeBytes)}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">
                          Uploaded {formatTimestamp(document.uploadedAt)}
                        </p>
                      </div>
                      <Button
                        onClick={() => {
                          const accessDecision = requestAdmissionsDocumentAccess(
                            records,
                            {
                              actor,
                              applicationId: record.applicationId,
                              documentId: document.documentId,
                            },
                          );

                          updateRecords(() => accessDecision.records);

                          if (!accessDecision.allowed || !accessDecision.document) {
                            setActiveDocumentSession(null);
                            setDocumentAccessMessage({
                              body:
                                accessDecision.reason ??
                                "Protected evidence could not be opened for this reviewer.",
                              tone: "warning",
                            });
                            capturePostHogEvent("admissions_document_preview_blocked", {
                              admissions_application_id: record.applicationId,
                              admissions_document_access_reason: accessDecision.reasonCode,
                              admissions_document_category: document.category,
                              admissions_document_id: document.documentId,
                            });
                            return;
                          }

                          setDocumentAccessMessage({
                            body: `Protected preview opened for ${accessDecision.document.filename}. Access logged ${formatTimestamp(
                              accessDecision.occurredAt,
                            )}.`,
                            tone: "info",
                          });
                          setActiveDocumentSession({
                            accessedAt: accessDecision.occurredAt,
                            document: accessDecision.document,
                          });
                          capturePostHogEvent("admissions_document_preview_opened", {
                            admissions_application_id: record.applicationId,
                            admissions_document_access_outcome: "opened",
                            admissions_document_category: document.category,
                            admissions_document_id: document.documentId,
                          });
                        }}
                        variant="outline"
                      >
                        View document
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </SurfaceCard>
          </div>

          <div className="grid gap-6">
            <SurfaceCard className="rounded-[32px] p-6">
              <SectionHeader
                title="Rollout mode"
                body="Each partner course line can run in a different coexistence mode while SIS remains system-of-record."
              />
              <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <StatusPill tone={rolloutDefinition.tone}>
                    {rolloutDefinition.label}
                  </StatusPill>
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                    {record.application.selectedCourse.providerCode} ·{" "}
                    {record.application.selectedCourse.courseCode}
                  </p>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  {rolloutDefinition.operatorSummary}
                </p>
                {rolloutSnapshot.isFallback ? (
                  <div className="mt-4 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    No explicit rollout config is stored for this course line, so the
                    portal is safely defaulting to Mode 1 review-only.
                  </div>
                ) : null}
              </div>
              {rolloutSnapshot.config?.transitions?.length ? (
                <div className="mt-5 grid gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Transition history
                  </p>
                  {rolloutSnapshot.config.transitions
                    .slice()
                    .reverse()
                    .slice(0, 3)
                    .map((transition) => (
                      <div
                        key={transition.eventId}
                        className={`rounded-[24px] border px-4 py-3 text-sm ${
                          transition.outcome === "applied"
                            ? "border-slate-200 bg-white text-slate-700"
                            : "border-amber-200 bg-amber-50 text-amber-900"
                        }`}
                      >
                        <p className="font-medium text-slate-950">
                          {transition.outcome === "applied"
                            ? `Mode changed to ${getPartnerCourseRolloutModeDefinition(transition.toMode).label}.`
                            : `Blocked mode change to ${getPartnerCourseRolloutModeDefinition(transition.toMode).label}.`}
                        </p>
                        <p className="mt-1 leading-6">{transition.reason}</p>
                        {transition.validationErrors?.length ? (
                          <p className="mt-1 leading-6">
                            {transition.validationErrors.join(" ")}
                          </p>
                        ) : null}
                        <p className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-500">
                          {transition.actor} | {formatTimestamp(transition.occurredAt)}
                        </p>
                      </div>
                    ))}
                </div>
              ) : null}
            </SurfaceCard>

            <SurfaceCard className="rounded-[32px] p-6">
              <SectionHeader
                title="Decision capture"
                body="Capture an immutable admissions outcome with reviewer attribution. Approved outcomes follow the active rollout mode for this partner course line."
              />
              {latestDecision ? (
                <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  Decision capture is locked because an immutable decision record has
                  already been stored for this review item. The latest outcome and
                  downstream trace remain visible below.
                </div>
              ) : (
                <div className="mt-5 grid gap-3">
                  {decisionReadiness.flags.map((flag) => (
                    <div
                      key={flag.code}
                      className={`rounded-[24px] border px-4 py-3 ${
                        flag.satisfied
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-amber-200 bg-amber-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">{flag.label}</p>
                          <p className="mt-1 text-sm text-slate-600">{flag.detail}</p>
                        </div>
                        <StatusPill tone={flag.satisfied ? "success" : "warning"}>
                          {flag.satisfied ? "Ready" : "Blocked"}
                        </StatusPill>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {decisionMessage ? (
                <div
                  className={`mt-4 rounded-[24px] border px-4 py-3 text-sm ${
                    decisionMessage.tone === "warning"
                      ? "border-amber-200 bg-amber-50 text-amber-900"
                      : "border-emerald-200 bg-emerald-50 text-emerald-900"
                  }`}
                >
                  {decisionMessage.body}
                </div>
              ) : null}
              {!latestDecision && !rolloutDefinition.decisionCaptureEnabled ? (
                <div className="mt-4 rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Decision capture is disabled because this course line is operating in{" "}
                  {rolloutDefinition.label}. Move it to Mode 2 or Mode 3 in the
                  workspace rollout registry before capturing an outcome here.
                </div>
              ) : null}
              {!latestDecision ? (
                <>
                  <div className="mt-5 grid gap-3">
                    <select
                      className="rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                      disabled={!rolloutDefinition.decisionCaptureEnabled}
                      onChange={(event) =>
                        setDecisionOutcome(event.target.value as AdmissionsDecisionOutcome)
                      }
                      value={decisionOutcome}
                    >
                      <option value="admit">Admit</option>
                      <option value="conditional">Conditional</option>
                      <option value="waitlist">Waitlist</option>
                      <option value="reject">Reject</option>
                    </select>
                    <select
                      className="rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                      disabled={!rolloutDefinition.decisionCaptureEnabled}
                      onChange={(event) => setDecisionReasonCode(event.target.value)}
                      value={decisionReasonCode}
                    >
                      {reasonOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <textarea
                      className="min-h-24 rounded-[24px] border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#0B4F74]"
                      disabled={!rolloutDefinition.decisionCaptureEnabled}
                      onChange={(event) => setDecisionNotes(event.target.value)}
                      placeholder="Optional reviewer rationale or handover note attached to the immutable decision record"
                      value={decisionNotes}
                    />
                  </div>
                  <Button
                    className="mt-4 w-full"
                    disabled={
                      !decisionReadiness.ready ||
                      isCapturingDecision ||
                      !rolloutDefinition.decisionCaptureEnabled
                    }
                    onClick={() => {
                      void handleCaptureDecision();
                    }}
                  >
                    {isCapturingDecision ? "Capturing decision..." : "Capture decision"}
                  </Button>
                </>
              ) : null}
              {record.decisionTrace.decisions.length > 0 ? (
                <div className="mt-5 grid gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Decision history
                  </p>
                  {record.decisionTrace.decisions
                    .slice()
                    .reverse()
                    .map((decision) => (
                      <div
                        key={decision.decisionId}
                        className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <StatusPill tone="neutral">
                            {formatAdmissionsDecisionOutcome(decision.outcome.status)}
                          </StatusPill>
                          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                            {decision.decidedBy} | {formatTimestamp(decision.decidedAt)}
                          </p>
                        </div>
                        <p className="mt-3 text-sm font-medium text-slate-900">
                          {getAdmissionsDecisionReasonLabel(
                            decision.outcome.reasonCode ?? "unspecified",
                          )}
                        </p>
                        {decision.outcome.notes ? (
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            {decision.outcome.notes}
                          </p>
                        ) : null}
                      </div>
                    ))}
                </div>
              ) : null}
            </SurfaceCard>

            <SurfaceCard className="rounded-[32px] p-6">
              <SectionHeader
                title="Downstream trace"
                body="Follow the latest decision into its rollout-mode boundary, export handoff, or automated provisioning route."
              />
              {latestDecision ? (
                <div className="mt-5 grid gap-4">
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <StatusPill tone="neutral">
                        {formatAdmissionsDecisionOutcome(latestDecision.outcome.status)}
                      </StatusPill>
                      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                        {latestDecision.decisionId}
                      </p>
                    </div>
                    <p className="mt-3 text-sm text-slate-700">
                      Reason:{" "}
                      <span className="font-medium text-slate-950">
                        {getAdmissionsDecisionReasonLabel(
                          latestDecision.outcome.reasonCode ?? "unspecified",
                        )}
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Decided by {latestDecision.decidedBy} at{" "}
                      {formatTimestamp(latestDecision.decidedAt)}.
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <StatusPill tone={rolloutDefinition.tone}>
                        {rolloutDefinition.label}
                      </StatusPill>
                      <p className="text-sm text-slate-600">
                        {rolloutDefinition.operatorSummary}
                      </p>
                    </div>
                  </div>

                  {latestExportArtifact ? (
                    <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <StatusPill tone="info">Structured export ready</StatusPill>
                        <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                          {latestExportArtifact.manifest.handoff.handoffMode}
                        </p>
                      </div>
                      <dl className="mt-4 grid gap-3 text-sm text-slate-700">
                        <MetadataRow
                          label="Export file"
                          value={latestExportArtifact.filename}
                        />
                        <MetadataRow
                          label="Manifest"
                          value={latestExportArtifact.manifest.manifestId}
                        />
                        <MetadataRow
                          label="Destination"
                          value={latestExportArtifact.manifest.handoff.destinationRef}
                        />
                        <MetadataRow
                          label="Idempotency key"
                          value={latestExportArtifact.idempotencyKey}
                        />
                        <MetadataRow
                          label="Generated"
                          value={formatTimestamp(latestExportArtifact.manifest.generatedAt)}
                        />
                      </dl>
                    </div>
                  ) : null}

                  {latestProvisioningJob ? (
                    <>
                      <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <StatusPill tone={getStatusTone(record.status)}>
                            {latestProvisioningJob.status.replaceAll("-", " ")}
                          </StatusPill>
                          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                            {latestProvisioningJob.adapterMode} |{" "}
                            {latestProvisioningJob.routingDecision.routeKey}
                          </p>
                        </div>
                        <dl className="mt-4 grid gap-3 text-sm text-slate-700">
                          <MetadataRow
                            label="Provisioning job"
                            value={latestProvisioningJob.jobId}
                          />
                          <MetadataRow
                            label="Correlation ID"
                            value={latestProvisioningJob.correlationId}
                          />
                          <MetadataRow
                            label="Target record"
                            value={latestProvisioningJob.targetRecordRef ?? "Pending"}
                          />
                          <MetadataRow
                            label="Attempts"
                            value={String(latestProvisioningJob.attempts.length)}
                          />
                          <MetadataRow
                            label="Reconciliation"
                            value={
                              latestReconciliation
                                ? latestReconciliation.status.replaceAll("-", " ")
                                : "Pending"
                            }
                          />
                        </dl>
                        {latestReconciliation ? (
                          <p className="mt-4 text-sm leading-6 text-slate-600">
                            {latestReconciliation.details}
                          </p>
                        ) : null}
                        {latestPortalRpaRun ? (
                          <div className="mt-4 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                            <p className="font-medium text-slate-950">
                              Portal RPA run: {latestPortalRpaRun.runState.replaceAll("-", " ")}
                            </p>
                            <p className="mt-1 leading-6">
                              {latestPortalRpaRun.details}
                            </p>
                            {latestPortalRpaRun.runbookTitle ? (
                              <p className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-500">
                                {latestPortalRpaRun.runbookTitle}
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                        {latestPortalRpaDriftSignal ? (
                          <div className="mt-4 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                            Drift signal: {latestPortalRpaDriftSignal.summary} Use{" "}
                            {latestPortalRpaDriftSignal.runbookTitle} before replaying
                            this route.
                          </div>
                        ) : null}
                        {openException ? (
                          <div className="mt-4 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                            Exception queued: {openException.summary}
                          </div>
                        ) : null}
                      </div>

                      {portalRpaEvidence.length > 0 ? (
                        <div className="grid gap-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Portal RPA evidence
                          </p>
                          {portalRpaEvidence.map((event) => (
                            <div
                              key={event.evidenceId}
                              className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <p className="text-sm font-medium text-slate-900">
                                  {event.details}
                                </p>
                                <StatusPill
                                  tone={
                                    event.outcome === "completed"
                                      ? "success"
                                      : event.outcome === "selector_drift"
                                        ? "warning"
                                        : "warning"
                                  }
                                >
                                  {event.outcome.replaceAll("_", " ")}
                                </StatusPill>
                              </div>
                              <p className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-500">
                                {event.stepKey} | {formatTimestamp(event.occurredAt)}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      <div className="grid gap-3">
                        {provisioningEvents.map((event) => (
                          <div
                            key={event.eventId}
                            className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"
                          >
                            <p className="text-sm font-medium text-slate-900">
                              {event.summary}
                            </p>
                            <p className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-500">
                              {event.type} | {formatTimestamp(event.occurredAt)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : !latestExportArtifact ? (
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                      {rolloutSnapshot.mode === "mode-1-review-only"
                        ? "Mode 1 stops inside the admissions workspace. Review evidence and operational notes remain visible here, but no downstream export or automated provisioning is triggered."
                        : latestDecision.outcome.status === "offer-made" ||
                            latestDecision.outcome.status === "conditional-offer"
                          ? "This approved decision does not yet have a downstream trace for the active mode."
                          : "This decision does not trigger downstream automation for the selected outcome."}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  Capture a decision to populate the downstream trace.
                </div>
              )}
            </SurfaceCard>

            <SurfaceCard className="rounded-[32px] p-6">
              <SectionHeader
                title="Workflow controls"
                body="Queue assignment and handover state changes are logged with actor and timestamp."
              />
              {isWorkflowLocked ? (
                <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Workflow controls are locked after decision capture. Post-decision
                  state now follows the immutable decision record and the active
                  rollout-mode handoff path.
                </div>
              ) : null}
              <div className="mt-5 flex flex-wrap gap-2">
                {statusOptions.map((status) => (
                  <Button
                    key={status}
                    className={
                      record.status === status
                        ? "border-[#0B4F74] bg-[#0B4F74] text-white hover:bg-[#083a55]"
                        : ""
                    }
                    disabled={isWorkflowLocked}
                    onClick={() => {
                      updateRecords((current) =>
                        updateAdmissionsStatus(current, {
                          actor,
                          applicationId: record.applicationId,
                          status,
                        }),
                      );
                      capturePostHogEvent("admissions_status_updated", {
                        admissions_application_id: record.applicationId,
                        admissions_status: status,
                      });
                    }}
                    variant={record.status === status ? "outline" : "outline"}
                  >
                    {status.replaceAll("-", " ")}
                  </Button>
                ))}
              </div>
            </SurfaceCard>

            <SurfaceCard className="rounded-[32px] p-6">
              <SectionHeader
                title="Assignment"
                body="Keep ownership visible before decision capture and downstream provisioning."
              />
              <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                  Current assignee
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  {record.assignee ?? "Unassigned"}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {record.assignedAt
                    ? `Updated ${formatTimestamp(record.assignedAt)} by ${record.assignedBy}`
                    : "This item has not been assigned yet."}
                </p>
              </div>
              <div className="mt-4 flex flex-col gap-3">
                <Button
                  onClick={() => {
                    updateRecords((current) =>
                      assignAdmissionsRecord(current, {
                        actor,
                        applicationId: record.applicationId,
                        assignee: actor,
                      }),
                    );
                  }}
                >
                  Assign to me
                </Button>
                <Button
                  onClick={() => {
                    updateRecords((current) =>
                      assignAdmissionsRecord(current, {
                        actor,
                        applicationId: record.applicationId,
                        assignee: undefined,
                      }),
                    );
                  }}
                  variant="outline"
                >
                  Clear assignment
                </Button>
              </div>
            </SurfaceCard>

            <SurfaceCard className="rounded-[32px] p-6">
              <SectionHeader
                title="Operational notes"
                body="Use notes for handover context that should stay attached to the review item."
              />
              <textarea
                className="mt-5 min-h-28 w-full rounded-[24px] border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#0B4F74]"
                onChange={(event) => setNoteDraft(event.target.value)}
                placeholder="Add a note for the next reviewer or decision owner"
                value={noteDraft}
              />
              <Button
                className="mt-4 w-full"
                onClick={() => {
                  updateRecords((current) =>
                    addAdmissionsNote(current, {
                      applicationId: record.applicationId,
                      author: actor,
                      body: noteDraft,
                    }),
                  );
                  if (noteDraft.trim()) {
                    capturePostHogEvent("admissions_note_added", {
                      admissions_application_id: record.applicationId,
                    });
                    setNoteDraft("");
                  }
                }}
              >
                Save handover note
              </Button>
              <div className="mt-5 grid gap-3">
                {record.notes.map((note) => (
                  <div
                    key={note.noteId}
                    className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"
                  >
                    <p className="text-sm leading-6 text-slate-800">{note.body}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.14em] text-slate-500">
                      {note.author} | {formatTimestamp(note.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            </SurfaceCard>

            <SurfaceCard className="rounded-[32px] p-6">
              <SectionHeader
                title="Audit trail"
                body="Assignment, queue-state, decision, provisioning, note, and document-access events remain visible by user and timestamp."
              />
              <div className="mt-5 grid gap-3">
                {record.auditEvents
                  .slice()
                  .reverse()
                  .map((event) => (
                    <div
                      key={event.eventId}
                      className="rounded-[24px] border border-slate-200 bg-white px-4 py-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-1 rounded-full bg-slate-100 p-2 text-slate-600">
                          {event.type === "note" ? (
                            <FileText className="h-4 w-4" />
                          ) : event.type === "status" ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : event.type === "decision" ? (
                            <ShieldCheck className="h-4 w-4" />
                          ) : event.type === "provisioning" ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : event.type === "document-access" ? (
                            event.metadata?.outcome === "blocked" ? (
                              <AlertCircle className="h-4 w-4" />
                            ) : (
                              <ShieldCheck className="h-4 w-4" />
                            )
                          ) : (
                            <AlertCircle className="h-4 w-4" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {event.summary}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">
                            {event.actor} | {formatTimestamp(event.occurredAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </SurfaceCard>
          </div>
        </div>
      </div>

      {activeDocumentSession ? (
        <ModalShell
          bodyClassName="space-y-4"
          maxWidthClassName="max-w-5xl"
          onClose={() => setActiveDocumentSession(null)}
          panelClassName="overflow-hidden"
          title={activeDocumentSession.document.filename}
        >
          <div className="rounded-[24px] border border-[#c6d8e3] bg-[#F2F8FB] px-4 py-3 text-sm text-[#0B4F74]">
            Protected preview only. Access logged {formatTimestamp(
              activeDocumentSession.accessedAt,
            )}. Raw source links stay hidden from the admissions workspace.
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_280px]">
            <iframe
              className="min-h-[560px] w-full rounded-[28px] border border-slate-200 bg-white"
              loading="lazy"
              referrerPolicy="no-referrer"
              sandbox=""
              srcDoc={previewMarkup}
              title={`${activeDocumentSession.document.filename} preview`}
            />
            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Preview metadata
              </p>
              <dl className="mt-4 grid gap-3 text-sm text-slate-700">
                <MetadataRow
                  label="Category"
                  value={activeDocumentSession.document.category}
                />
                <MetadataRow
                  label="Content type"
                  value={activeDocumentSession.document.contentType}
                />
                <MetadataRow
                  label="Size"
                  value={formatFileSize(activeDocumentSession.document.sizeBytes)}
                />
                <MetadataRow
                  label="Uploaded"
                  value={formatTimestamp(activeDocumentSession.document.uploadedAt)}
                />
                <MetadataRow
                  label="Submission required"
                  value={
                    activeDocumentSession.document.requiredForSubmission
                      ? "Yes"
                      : "No"
                  }
                />
                <MetadataRow label="Viewer" value={actor} />
                <MetadataRow
                  label="Access logged"
                  value={formatTimestamp(activeDocumentSession.accessedAt)}
                />
              </dl>
            </div>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}

function SectionHeader({ body, title }: { body: string; title: string }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
    </div>
  );
}

function DetailCard({
  icon,
  label,
  value,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
      <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-slate-500">
        {icon}
        {label}
      </span>
      <span className="mt-2 block text-sm font-medium text-slate-900">{value}</span>
    </div>
  );
}

function EvidenceCard({
  title,
  subtitle,
  meta,
}: {
  meta: string;
  subtitle: string;
  title: string;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-base font-semibold text-slate-950">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
      <p className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-500">{meta}</p>
    </div>
  );
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-1 font-medium text-slate-950">{value}</dd>
    </div>
  );
}
