import {
  ArrowRight,
  CalendarDays,
  ChevronsRight,
  Clock3,
  Monitor,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { SurfaceCard } from "../../components/SurfaceCard";
import { Button } from "../../components/ui/button";
import { activeBrand, isUcBrand } from "../../lib/brand";
import type { CourseCatalogEntry } from "../../lib/courseCatalog";
import { getUcCourseCardMedia } from "./ucCourseCardMedia";

interface CourseBrowseCardProps {
  course: CourseCatalogEntry;
  onViewCourse: (courseCode: string) => void;
}

export function CourseBrowseCard({ course, onViewCourse }: CourseBrowseCardProps) {
  if (isUcBrand) {
    return <UcCourseBrowseCard course={course} />;
  }

  return <StudyNextCourseBrowseCard course={course} onViewCourse={onViewCourse} />;
}

function UcCourseBrowseCard({ course }: { course: CourseCatalogEntry }) {
  const media = getUcCourseCardMedia(course);
  const titleId = `course-card-title-${course.code}`;
  const mediaBadge =
    course.deliveryMode === "online_plus"
      ? "Online Plus"
      : course.intakeLabel !== "Upcoming intake"
        ? `${course.intakeLabel} intake`
        : null;

  return (
    <SurfaceCard className="group h-full min-w-0 overflow-hidden rounded-none border-slate-200 p-0 shadow-none transition duration-200 hover:-translate-y-1 hover:border-[var(--brand-accent)]/50 hover:shadow-[0_18px_40px_rgba(65,77,97,0.16)] focus-within:border-[var(--brand-accent)]">
      <Link
        aria-labelledby={titleId}
        className="flex h-full min-w-0 flex-col bg-white text-left no-underline"
        to={`/courses/${course.code}`}
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-[var(--background-tinted)]">
          <img
            alt={media.alt}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]"
            decoding="async"
            src={media.src}
          />
          {mediaBadge ? (
            <span className="absolute left-3 top-3 rounded-full bg-[var(--cta-primary)] px-3 py-1.5 text-xs font-semibold text-white shadow-sm">
              {mediaBadge}
            </span>
          ) : null}
          {activeBrand.logo ? (
            <div
              aria-hidden="true"
              className="content-block-compact absolute bottom-0 right-0 flex h-28 w-36 items-center justify-center bg-white p-3 sm:h-32 sm:w-40"
            >
              <img
                alt=""
                className="h-auto w-full"
                src={activeBrand.logo.fullColour}
              />
            </div>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-1 flex-col p-5 sm:p-6">
          <p className="text-base font-medium text-slate-400">{course.provider}</p>
          <div className="mt-3 flex items-start gap-3">
            <h2
              className="min-w-0 flex-1 break-words text-[1.45rem] font-bold leading-[1.12] text-slate-950 sm:text-[1.6rem]"
              id={titleId}
            >
              {course.title}
            </h2>
            <ChevronsRight
              aria-hidden="true"
              className="mt-0.5 h-8 w-8 shrink-0 text-[var(--brand-accent)] transition-transform duration-200 group-hover:translate-x-1"
              strokeWidth={2.5}
            />
          </div>

          <p className="mt-4 line-clamp-2 min-h-12 text-sm leading-6 text-slate-600 sm:text-base">
            {course.summary ?? "Explore this flexible University of Canberra postgraduate course."}
          </p>

          <div className="mt-auto flex flex-wrap gap-2 pt-5">
            <UcCourseMetaChip icon={<Monitor className="h-3.5 w-3.5" />}>
              {course.delivery}
            </UcCourseMetaChip>
            <UcCourseMetaChip icon={<Clock3 className="h-3.5 w-3.5" />}>
              {course.duration || "Flexible study"}
            </UcCourseMetaChip>
            <UcCourseMetaChip icon={<CalendarDays className="h-3.5 w-3.5" />}>
              {course.intakeLabel}
            </UcCourseMetaChip>
          </div>
        </div>
      </Link>
    </SurfaceCard>
  );
}

function UcCourseMetaChip({
  children,
  icon,
}: {
  children: ReactNode;
  icon: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
      {icon}
      {children}
    </span>
  );
}

function StudyNextCourseBrowseCard({
  course,
  onViewCourse,
}: CourseBrowseCardProps) {
  return (
    <SurfaceCard className="h-full min-w-0 rounded-[24px] border-slate-200 p-0">
      <div className="flex h-full min-w-0 flex-col p-4">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-[var(--success-bg)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--success-text)]">
            {course.delivery}
          </span>
          {course.categories.map((category) => (
            <span
              key={category}
              className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600"
            >
              {category}
            </span>
          ))}
        </div>

        <p className="mt-3 break-words text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          {course.provider}
        </p>
        <h2 className="mt-1.5 break-words text-lg font-bold leading-snug text-slate-950">
          {course.title}
        </h2>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <CourseComparisonItem label="Next intake" value={course.intakeLabel} />
          <CourseComparisonItem
            label="Duration"
            value={course.duration || "Flexible study"}
          />
          <CourseComparisonItem
            label="Approx. fees"
            value={course.feeSummary || "Contact provider"}
          />
          <CourseComparisonItem
            label="Support"
            value={course.supportSummary || "Check provider"}
          />
        </div>

        <div className="mt-auto pt-4">
          <Button
            className="w-full"
            size="sm"
            onClick={() => onViewCourse(course.code)}
          >
            View course
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </SurfaceCard>
  );
}

function CourseComparisonItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="content-block-compact rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium leading-6 text-slate-950">{value}</p>
    </div>
  );
}
