import {
  CalendarDays,
  ClipboardCheck,
  Clock3,
  GraduationCap,
  Monitor,
  Save,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { AppBrandHeader } from "../../components/AppBrandHeader";
import { CopiedApplicationNotice } from "../../components/CopiedApplicationNotice";
import { SurfaceCard } from "../../components/SurfaceCard";
import type { ApplicationPrefillSource } from "../../lib/applicationData";
import { isUcBrand } from "../../lib/brand";
import type { CourseCatalogEntry } from "../../lib/courseCatalog";
import type { OverviewActionDescriptor } from "../../lib/overviewAction";
import { OverviewContinuePanel } from "./OverviewContinuePanel";

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

const ucOverviewSections: ReadonlyArray<{
  body: string;
  heading: string;
  icon: LucideIcon;
  step: string;
  title: string;
}> = [
  {
    step: "01",
    title: "Section 1",
    heading: "About you",
    body:
      "Share your personal and contact details, citizenship and anything that may help UC support your studies.",
    icon: UserRound,
  },
  {
    step: "02",
    title: "Section 2",
    heading: "Study and experience",
    body:
      "Add your education and work history. Upload your transcript and CV, and we’ll organise the evidence for review.",
    icon: GraduationCap,
  },
  {
    step: "03",
    title: "Section 3",
    heading: "Check and submit",
    body:
      "Review your answers, resolve anything that is still missing and send your application to UC Admissions.",
    icon: ClipboardCheck,
  },
];

interface OverviewCourseMedia {
  alt: string;
  src: string;
}

interface OverviewPageProps {
  course: CourseCatalogEntry;
  courseMedia?: OverviewCourseMedia;
  nextAction: OverviewActionDescriptor;
  onContinue: () => void;
  prefilledFrom?: ApplicationPrefillSource;
}

export function OverviewPage({
  course,
  courseMedia,
  nextAction,
  onContinue,
  prefilledFrom,
}: OverviewPageProps) {
  if (isUcBrand) {
    return (
      <UcOverviewPage
        course={course}
        courseMedia={courseMedia}
        nextAction={nextAction}
        onContinue={onContinue}
        prefilledFrom={prefilledFrom}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] pb-28 sm:pb-10">
      <AppBrandHeader maxWidthClassName="max-w-5xl" />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <SurfaceCard className="p-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row">
            <div className="brand-hero content-block-compact h-32 w-full rounded-[28px] sm:w-48" />
            <div className="flex-1">
              <h2 className="text-xl font-bold text-slate-900">{course.title}</h2>
              <div className="content-block-compact mt-4 max-w-xs rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-700">
                Desired course intake: {course.intakeLabel}
              </div>
            </div>
          </div>
        </SurfaceCard>

        {prefilledFrom ? (
          <CopiedApplicationNotice className="mt-5" prefilledFrom={prefilledFrom} />
        ) : null}

        <div className="mt-8">
          <h1 className="text-3xl font-bold text-slate-900">Application Overview</h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
            Be prepared by having your documents ready up front. A typical
            application process can take 30 to 60 minutes to complete. You can
            save your progress at any stage and come back later.
          </p>
        </div>

        <OverviewContinuePanel nextAction={nextAction} onContinue={onContinue} />

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {overviewSections.map((section) => (
            <OverviewSectionCard key={section.title} section={section} />
          ))}
        </div>
      </div>
    </div>
  );
}

function UcOverviewPage({
  course,
  courseMedia,
  nextAction,
  onContinue,
  prefilledFrom,
}: OverviewPageProps) {
  return (
    <div className="min-h-screen bg-[var(--background)] pb-28 sm:pb-12">
      <AppBrandHeader maxWidthClassName="max-w-6xl" />

      <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
        <SurfaceCard className="overflow-hidden p-0">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
            <div className="aspect-[16/10] min-h-56 overflow-hidden bg-[var(--background-tinted)] lg:aspect-auto lg:min-h-80">
              {courseMedia ? (
                <img
                  alt={courseMedia.alt}
                  className="h-full w-full object-cover"
                  decoding="async"
                  fetchPriority="high"
                  src={courseMedia.src}
                />
              ) : (
                <div className="brand-hero h-full w-full" aria-hidden="true" />
              )}
            </div>

            <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-10">
              <p className="text-sm font-semibold text-[var(--brand-accent-strong)]">
                Your selected course
              </p>
              <h2 className="mt-3 max-w-2xl text-3xl font-bold leading-tight text-slate-950 sm:text-4xl">
                {course.title}
              </h2>
              <p className="mt-3 text-base text-slate-600">{course.provider}</p>

              <dl className="mt-7 grid grid-cols-3 gap-3 border-t border-[var(--border)] pt-6 sm:gap-5">
                <CourseFact
                  icon={CalendarDays}
                  label="Next intake"
                  value={course.intakeLabel}
                />
                <CourseFact
                  icon={Monitor}
                  label="Study mode"
                  value={course.delivery}
                />
                <CourseFact
                  icon={Clock3}
                  label="Study length"
                  value={course.duration || "Flexible study"}
                />
              </dl>
            </div>
          </div>
        </SurfaceCard>

        {prefilledFrom ? (
          <CopiedApplicationNotice className="mt-5" prefilledFrom={prefilledFrom} />
        ) : null}

        <section className="mt-10" aria-labelledby="application-overview-heading">
          <h1
            className="text-4xl font-bold leading-tight text-slate-950 sm:text-5xl"
            id="application-overview-heading"
          >
            Your UC application
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
            Complete the three sections below. Have your transcript and CV nearby
            so we can help organise the evidence UC needs for your application.
          </p>
          <div className="mt-5 flex flex-col gap-3 text-sm font-medium text-slate-700 sm:flex-row sm:gap-8">
            <span className="inline-flex items-center gap-2">
              <Clock3
                aria-hidden="true"
                className="h-5 w-5 text-[var(--brand-accent-strong)]"
              />
              Allow around 30–60 minutes
            </span>
            <span className="inline-flex items-center gap-2">
              <Save
                aria-hidden="true"
                className="h-5 w-5 text-[var(--brand-accent-strong)]"
              />
              Your progress is saved as you go
            </span>
          </div>
        </section>

        <OverviewContinuePanel nextAction={nextAction} onContinue={onContinue} />

        <ol className="mt-8 grid list-none gap-5 p-0 md:grid-cols-3">
          {ucOverviewSections.map((section) => (
            <li key={section.title}>
              <UcOverviewSectionCard section={section} />
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}

function CourseFact({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:gap-3">
      <Icon
        aria-hidden="true"
        className="h-5 w-5 shrink-0 text-[var(--brand-accent-strong)] sm:mt-0.5"
        strokeWidth={1.9}
      />
      <div className="min-w-0">
        <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500 sm:text-xs sm:tracking-[0.12em]">
          {label}
        </dt>
        <dd className="mt-1 break-words text-xs font-semibold leading-5 text-slate-900 sm:text-sm">
          {value}
        </dd>
      </div>
    </div>
  );
}

function OverviewSectionCard({
  section,
}: {
  section: (typeof overviewSections)[number];
}) {
  return (
    <SurfaceCard className="border-[var(--cta-secondary)]/10 bg-[var(--background-soft-blue)] p-6">
      <div className="h-16 w-16 rounded-[24px] bg-[var(--cta-secondary)]/10" />
      <p className="mt-4 text-lg font-bold text-[var(--cta-secondary)]">
        {section.title}
      </p>
      <h3 className="mt-2 text-xl font-bold text-slate-900">{section.heading}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-700">{section.body}</p>
    </SurfaceCard>
  );
}

function UcOverviewSectionCard({
  section,
}: {
  section: (typeof ucOverviewSections)[number];
}) {
  const Icon = section.icon;

  return (
    <SurfaceCard className="h-full border-t-4 border-t-[var(--brand-accent)] p-6 shadow-none">
      <div className="flex items-start justify-between gap-4">
        <div className="content-block-compact flex h-14 w-14 items-center justify-center bg-[var(--background-soft-blue)] text-[var(--brand-accent-strong)]">
          <Icon aria-hidden="true" className="h-7 w-7" strokeWidth={1.8} />
        </div>
        <span className="font-display text-3xl font-semibold text-[var(--brand-accent)]/35">
          {section.step}
        </span>
      </div>
      <p className="mt-5 text-sm font-semibold text-[var(--brand-accent-strong)]">
        {section.title}
      </p>
      <h3 className="mt-2 text-2xl font-bold leading-tight text-slate-950">
        {section.heading}
      </h3>
      <p className="mt-3 text-base leading-7 text-slate-600">{section.body}</p>
    </SurfaceCard>
  );
}
