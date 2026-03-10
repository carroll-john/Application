import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Mail,
  Phone,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
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
  findAdmissionsRecord,
  loadAdmissionsWorkspaceRecords,
  saveAdmissionsWorkspaceRecords,
  updateAdmissionsStatus,
  type AdmissionsQueueRecord,
  type AdmissionsQueueStatus,
} from "../lib/admissionsWorkspace";
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
  const { companyUserDisplayName, companyUserEmail } = useAuth();
  const actor = companyUserEmail ?? "admissions.user@keypath.com.au";
  const { records, updateRecords } = useAdmissionsWorkspaceRecords();
  const record = useMemo(
    () => (applicationId ? findAdmissionsRecord(records, applicationId) : undefined),
    [applicationId, records],
  );
  const [noteDraft, setNoteDraft] = useState("");
  const [activeDocument, setActiveDocument] =
    useState<CanonicalDocumentReference | null>(null);

  if (!record) {
    return (
      <div className="min-h-screen bg-[#f7f7f4]">
        <AppBrandHeader>
          <Button onClick={() => navigate("/admissions")} variant="outline">
            Back to queue
          </Button>
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

  const previewMarkup = activeDocument
    ? buildAdmissionsDocumentPreview(record, activeDocument)
    : "";

  return (
    <div className="min-h-screen bg-[#f7f7f4]">
      <AppBrandHeader>
        <Button onClick={() => navigate("/admissions")} variant="outline">
          Back to queue
        </Button>
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
                          setActiveDocument(document);
                          capturePostHogEvent("admissions_document_preview_opened", {
                            admissions_application_id: record.applicationId,
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
                title="Workflow controls"
                body="Queue assignment and handover state changes are logged with actor and timestamp."
              />
              <div className="mt-5 flex flex-wrap gap-2">
                {statusOptions.map((status) => (
                  <Button
                    key={status}
                    className={
                      record.status === status
                        ? "border-[#0B4F74] bg-[#0B4F74] text-white hover:bg-[#083a55]"
                        : ""
                    }
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
                body="Assignment and queue-state changes remain visible by user and timestamp."
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

      {activeDocument ? (
        <ModalShell
          bodyClassName="space-y-4"
          maxWidthClassName="max-w-5xl"
          onClose={() => setActiveDocument(null)}
          panelClassName="overflow-hidden"
          title={activeDocument.filename}
        >
          <div className="rounded-[24px] border border-[#c6d8e3] bg-[#F2F8FB] px-4 py-3 text-sm text-[#0B4F74]">
            Protected preview only. Raw source links stay hidden from the admissions workspace.
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_280px]">
            <iframe
              className="min-h-[560px] w-full rounded-[28px] border border-slate-200 bg-white"
              srcDoc={previewMarkup}
              title={`${activeDocument.filename} preview`}
            />
            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Preview metadata
              </p>
              <dl className="mt-4 grid gap-3 text-sm text-slate-700">
                <MetadataRow label="Category" value={activeDocument.category} />
                <MetadataRow label="Content type" value={activeDocument.contentType} />
                <MetadataRow label="Size" value={formatFileSize(activeDocument.sizeBytes)} />
                <MetadataRow label="Uploaded" value={formatTimestamp(activeDocument.uploadedAt)} />
                <MetadataRow
                  label="Submission required"
                  value={activeDocument.requiredForSubmission ? "Yes" : "No"}
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
