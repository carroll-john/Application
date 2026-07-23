import {
  Award,
  BriefcaseBusiness,
  ChevronRight,
  Clock3,
  GraduationCap,
  Info,
  ListChecks,
  Pencil,
  School,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  formatUcExperienceDuration,
  getUcExperienceGroupLabel,
  getUcExperienceReviewGuidance,
  getUcWorkEntryGuidance,
  summarizeUcExperienceByOscaLevel,
  type CvRecognitionDraft,
  type UcOscaExperienceSummary,
  type UcOscaExperienceSummaryKey,
} from "../../lib/ucRplAssessment";

interface UcRplExperienceReviewProps {
  draft: CvRecognitionDraft;
  fileName: string;
  onChange: (draft: CvRecognitionDraft) => void;
  onContinue: () => void;
  onStartOver: () => void;
}

function formatRolePeriod(role: CvRecognitionDraft["experiences"][number]) {
  const start = [role.startMonth, role.startYear].filter(Boolean).join(" ");
  const end = role.currentRole
    ? "Present"
    : [role.endMonth, role.endYear].filter(Boolean).join(" ");
  return [start, end].filter(Boolean).join(" – ") || "Dates not found";
}

function roleCountLabel(summary: UcOscaExperienceSummary) {
  if (summary.includedRoleCount === summary.roles.length) {
    return `${summary.roles.length} ${summary.roles.length === 1 ? "role" : "roles"} from CV`;
  }

  return `${summary.includedRoleCount} of ${summary.roles.length} roles included`;
}

function ExperienceSummaryEditor({
  draft,
  onChange,
  onClose,
  summary,
}: {
  draft: CvRecognitionDraft;
  onChange: (draft: CvRecognitionDraft) => void;
  onClose: () => void;
  summary: UcOscaExperienceSummary;
}) {
  return (
    <div className="border-t border-[var(--border)] bg-slate-50 p-5 sm:p-6">
      <div className="border-b border-[var(--border)] pb-5">
        <h3 className="text-lg font-semibold text-slate-950">Review these roles</h3>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
          Choose which roles to include and check the occupation we matched to the
          work described in your CV.
        </p>
      </div>

      <div className="mt-5 space-y-3">
        {summary.roles.map((role) => {
          const roleIndex = draft.experiences.findIndex((item) => item.id === role.id);

          return (
            <article
              key={role.id}
              className="border border-[var(--border)] bg-white p-4 sm:p-5"
            >
              <div className="flex items-start gap-3">
                <input
                  aria-label={`Include ${role.position} in my experience summary`}
                  className="mt-1 h-5 w-5 rounded border-slate-300 text-[var(--cta-primary)] focus:ring-[var(--cta-primary)]"
                  type="checkbox"
                  checked={role.includeInAssessment}
                  onChange={(event) => {
                    if (roleIndex < 0) return;
                    const experiences = [...draft.experiences];
                    experiences[roleIndex] = {
                      ...role,
                      includeInAssessment: event.target.checked,
                    };
                    onChange({ ...draft, experiences });
                  }}
                />
                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold text-slate-950">
                    {role.position || "Role title not found"}
                  </h4>
                  <p className="mt-1 text-sm text-slate-600">
                    {[role.company, formatRolePeriod(role)].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem] sm:items-start">
                <div>
                  <Label htmlFor={`matched-occupation-${role.id}`}>
                    Matched occupation
                  </Label>
                  <Input
                    id={`matched-occupation-${role.id}`}
                    value={role.oscaOccupationTitle}
                    placeholder="Enter the closest occupation"
                    onChange={(event) => {
                      if (roleIndex < 0) return;
                      const experiences = [...draft.experiences];
                      experiences[roleIndex] = {
                        ...role,
                        oscaOccupationTitle: event.target.value,
                      };
                      onChange({ ...draft, experiences });
                    }}
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    Experience level
                  </p>
                  <p className="mt-2 font-semibold text-slate-950">
                    {role.oscaSkillLevel
                      ? `Level ${role.oscaSkillLevel}`
                      : "Needs review"}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Based on the matched occupation.
                  </p>
                </div>
              </div>

              {role.oscaRationale ? (
                <p className="mt-5 border-l-2 border-blue-200 pl-4 text-sm leading-6 text-slate-600">
                  {role.oscaRationale}
                </p>
              ) : null}
            </article>
          );
        })}
      </div>

      <div className="mt-5 flex justify-end">
        <Button variant="outline" onClick={onClose}>
          Done editing
        </Button>
      </div>
    </div>
  );
}

export function ExperienceSummaryRow({
  draft,
  isEditing,
  onChange,
  onEdit,
  summary,
}: {
  draft: CvRecognitionDraft;
  isEditing: boolean;
  onChange: (draft: CvRecognitionDraft) => void;
  onEdit: () => void;
  summary: UcOscaExperienceSummary;
}) {
  const cellClassName =
    "flex min-h-24 items-center gap-3 bg-white px-4 py-5 sm:min-h-28";

  return (
    <article className="border-b border-[var(--border)] last:border-b-0">
      <div
        aria-label="Experience summary"
        className="grid gap-px bg-[var(--border)] sm:grid-cols-2 xl:grid-cols-[0.9fr_1fr_1.05fr_1.15fr_0.72fr]"
      >
        <div className={cellClassName}>
          <ListChecks
            className="h-6 w-6 shrink-0 text-[var(--cta-secondary)]"
            aria-hidden="true"
          />
          <span className="font-semibold text-slate-900">
            {roleCountLabel(summary)}
          </span>
        </div>
        <div className={cellClassName}>
          <Clock3
            className="h-6 w-6 shrink-0 text-[var(--cta-secondary)]"
            aria-hidden="true"
          />
          <span className="font-semibold text-slate-900">
            {summary.includedRoleCount > 0
              ? formatUcExperienceDuration(summary.experienceMonths)
              : "Not included in matching"}
          </span>
        </div>
        <div className={cellClassName}>
          <BriefcaseBusiness
            className="h-6 w-6 shrink-0 text-[var(--cta-secondary)]"
            aria-hidden="true"
          />
          <span className="font-semibold text-slate-900">
            {getUcExperienceGroupLabel(summary.skillLevel)}
          </span>
        </div>
        <div className="flex min-h-24 items-center gap-3 bg-[var(--info-bg)] px-4 py-5 sm:min-h-28">
          <GraduationCap
            className="h-6 w-6 shrink-0 text-[var(--info-text)]"
            aria-hidden="true"
          />
          <span className="font-semibold text-[var(--info-text)]">
            {getUcWorkEntryGuidance(summary.skillLevel, summary.experienceMonths)}
          </span>
        </div>
        <button
          type="button"
          aria-expanded={isEditing}
          className="flex min-h-20 items-center justify-center gap-2 bg-[var(--cta-secondary)] px-4 py-5 font-bold text-white transition-colors hover:bg-[var(--cta-secondary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-white sm:col-span-2 sm:min-h-28 xl:col-span-1"
          onClick={onEdit}
        >
          <Pencil className="h-5 w-5" aria-hidden="true" />
          {isEditing ? "Close" : "Edit"}
        </button>
      </div>
      {isEditing ? (
        <ExperienceSummaryEditor
          draft={draft}
          onChange={onChange}
          onClose={onEdit}
          summary={summary}
        />
      ) : null}
    </article>
  );
}

function QualificationsFound({ draft }: { draft: CvRecognitionDraft }) {
  const qualificationCount =
    draft.tertiaryQualifications.length +
    draft.secondaryQualifications.length +
    draft.professionalAccreditations.length;

  const rows = [
    ...draft.tertiaryQualifications.map((qualification) => ({
      detail: [
        qualification.level,
        qualification.institution,
        qualification.endYear ? `Completed ${qualification.endYear}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
      icon: GraduationCap,
      id: qualification.id,
      kind: "Tertiary qualification",
      title: qualification.courseName || qualification.level || "Qualification",
    })),
    ...draft.secondaryQualifications.map((qualification) => ({
      detail: [qualification.type, qualification.school, qualification.year]
        .filter(Boolean)
        .join(" · "),
      icon: School,
      id: qualification.id,
      kind: "Secondary qualification",
      title: qualification.qualification || qualification.type || "Qualification",
    })),
    ...draft.professionalAccreditations.map((accreditation) => ({
      detail: accreditation.status,
      icon: Award,
      id: accreditation.id,
      kind: "Professional accreditation",
      title: accreditation.name || "Accreditation",
    })),
  ];

  return (
    <section
      aria-labelledby="cv-qualifications-heading"
      className="content-block border border-[var(--border)] bg-white"
    >
      <div className="border-b border-[var(--border)] p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2
            id="cv-qualifications-heading"
            className="text-2xl font-semibold text-slate-950"
          >
            Qualifications found in your CV
          </h2>
          <span className="text-sm font-semibold text-slate-500">
            {qualificationCount} found
          </span>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          We found these qualifications in your CV. You can confirm or update them
          later if you decide to apply.
        </p>
      </div>

      {rows.length > 0 ? (
        <div className="divide-y divide-[var(--border)]">
          {rows.map((row) => (
            <article key={`${row.kind}-${row.id}`} className="flex gap-4 p-5 sm:p-6">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center bg-blue-50 text-[var(--cta-secondary)]">
                <row.icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {row.kind}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-950">
                  {row.title}
                </h3>
                {row.detail ? (
                  <p className="mt-1 text-sm leading-6 text-slate-600">{row.detail}</p>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="p-6 text-sm leading-6 text-slate-600">
          No qualifications were listed in this CV. You can add them later if you
          decide to apply.
        </p>
      )}
    </section>
  );
}

export function UcRplExperienceReview({
  draft,
  fileName,
  onChange,
  onContinue,
  onStartOver,
}: UcRplExperienceReviewProps) {
  const [editingSummaryKey, setEditingSummaryKey] =
    useState<UcOscaExperienceSummaryKey | null>(null);
  const summaries = useMemo(
    () => summarizeUcExperienceByOscaLevel(draft.experiences),
    [draft.experiences],
  );
  const includedCount = draft.experiences.filter(
    (experience) => experience.includeInAssessment,
  ).length;
  const displayFileName = fileName.startsWith("synthetic-") ? "Sample CV" : fileName;

  return (
    <section aria-labelledby="review-experience-heading" className="space-y-6">
      <div className="content-block border border-[var(--border)] bg-white p-6 sm:p-9">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--cta-secondary)]">
              {displayFileName}
            </p>
            <h1
              id="review-experience-heading"
              className="mt-2 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl"
            >
              Review your experience
            </h1>
            <p className="mt-3 max-w-3xl text-lg leading-8 text-slate-600">
              We found the roles and qualifications below in your CV. Check they
              look right before we show you courses that may match your experience.
            </p>
          </div>
          <Button variant="neutralOutline" onClick={onStartOver}>
            Upload another CV
          </Button>
        </div>
      </div>

      <section
        aria-labelledby="experience-summary-heading"
        className="content-block border border-[var(--border)] bg-white"
      >
        <div className="border-b border-[var(--border)] p-5 sm:p-6">
          <h2
            id="experience-summary-heading"
            className="text-2xl font-semibold text-slate-950"
          >
            Your work experience
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
            We’ve grouped similar roles together. If two roles happened at the same
            time, we’ve only counted those dates once. You can review a group if
            something doesn’t look right.
          </p>
        </div>

        <div>
          {summaries.map((summary) => (
            <ExperienceSummaryRow
              key={summary.key}
              draft={draft}
              isEditing={editingSummaryKey === summary.key}
              onChange={onChange}
              onEdit={() =>
                setEditingSummaryKey((current) =>
                  current === summary.key ? null : summary.key,
                )
              }
              summary={summary}
            />
          ))}
        </div>

        <div className="flex gap-3 border-t border-blue-200 bg-blue-50 p-5 text-sm leading-6 text-slate-700 sm:p-6">
          <Info
            className="mt-0.5 h-5 w-5 shrink-0 text-[var(--cta-secondary)]"
            aria-hidden="true"
          />
          <p>{getUcExperienceReviewGuidance(summaries)}</p>
        </div>
      </section>

      <QualificationsFound draft={draft} />

      <div className="content-block flex flex-col gap-4 border border-[var(--border)] bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-slate-600">
          Check that we’ve included the right roles. You can update the details
          again before you apply.
        </p>
        <Button disabled={includedCount === 0} onClick={onContinue}>
          Find my course matches
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </section>
  );
}
