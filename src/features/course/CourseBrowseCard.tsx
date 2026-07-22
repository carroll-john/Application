import { ArrowRight } from "lucide-react";
import { SurfaceCard } from "../../components/SurfaceCard";
import { Button } from "../../components/ui/button";
import type { CourseCatalogEntry } from "../../lib/courseCatalog";

interface CourseBrowseCardProps {
  course: CourseCatalogEntry;
  onViewCourse: (courseCode: string) => void;
}

export function CourseBrowseCard({ course, onViewCourse }: CourseBrowseCardProps) {
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
