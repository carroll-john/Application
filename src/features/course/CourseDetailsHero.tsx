import { AccentIconBadge } from "../../components/AccentIconBadge";
import { SurfaceCard } from "../../components/SurfaceCard";
import { Button } from "../../components/ui/button";
import type { CourseCatalogEntry } from "../../lib/courseCatalog";
import { capturePostHogEvent, getCourseAnalyticsProperties } from "../../lib/posthog";
import { CourseChecklist } from "./CourseChecklist";

interface CourseDetailsHeroProps {
  course: CourseCatalogEntry;
  onOpenEligibilityCheck: () => void;
}

export function CourseDetailsHero({
  course,
  onOpenEligibilityCheck,
}: CourseDetailsHeroProps) {
  return (
    <section className="brand-hero text-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:px-8 lg:py-16">
        <div className="max-w-2xl">
          <div className="flex flex-wrap gap-3">
            <span className="inline-flex rounded-full bg-white/10 px-4 py-2 text-sm font-semibold tracking-wide text-white/90">
              {course.delivery}
            </span>
            {course.categories.map((category) => (
              <span
                key={category}
                className="inline-flex rounded-full bg-white/10 px-4 py-2 text-sm font-semibold tracking-wide text-white/90"
              >
                {category}
              </span>
            ))}
          </div>
          <h1 className="mt-6 text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
            {course.title}
          </h1>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <CourseHeroFact label="Provider" value={course.provider} />
            <CourseHeroFact
              label="Duration"
              value={course.duration || "Flexible study"}
            />
            <CourseHeroFact label="Intake" value={course.intakeLabel} />
          </div>
        </div>

        <SurfaceCard className="rounded-[36px] border-0 bg-[var(--background-soft-blue)] p-6 text-slate-900 shadow-[0_32px_60px_rgba(31,42,58,0.25)] sm:p-8">
          <AccentIconBadge className="mb-6" size="lg" tone="brandSoft">
            <svg
              aria-hidden="true"
              className="h-8 w-8"
              fill="none"
              viewBox="0 0 24 24"
            >
              <rect
                x="3"
                y="4"
                width="18"
                height="16"
                rx="2"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M7 8h10M7 12h6"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="2"
              />
            </svg>
          </AccentIconBadge>
          <h2 className="text-2xl font-bold text-[var(--cta-secondary)]">
            Start your application
          </h2>
          <CourseChecklist
            items={[
              course.eligibilityPolicy === "manual_review"
                ? "Prepare evidence for an admissions review"
                : "Start with a course-specific evidence check",
              "Create or reuse your profile after sign in",
              "Save and resume applications across courses",
            ]}
          />
          <div className="mt-6 rounded-[28px] border border-slate-200 bg-white px-5 py-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">At a glance</p>
            <dl className="mt-3 space-y-3">
              <div>
                <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">
                  Study level
                </dt>
                <dd className="mt-1 font-medium">{course.studyLevel}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">
                  Course type
                </dt>
                <dd className="mt-1 font-medium">{course.courseType}</dd>
              </div>
              {course.feeSummary ? (
                <div>
                  <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    Fees
                  </dt>
                  <dd className="mt-1 font-medium">{course.feeSummary}</dd>
                </div>
              ) : null}
              {course.supportSummary ? (
                <div>
                  <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    Support
                  </dt>
                  <dd className="mt-1 text-slate-600">{course.supportSummary}</dd>
                </div>
              ) : null}
            </dl>
          </div>
          <Button
            className="mt-8 w-full"
            onClick={() => {
              capturePostHogEvent("eligibility_check_opened", {
                ...getCourseAnalyticsProperties(course),
              });
              onOpenEligibilityCheck();
            }}
          >
            Check Required Evidence
          </Button>
        </SurfaceCard>
      </div>
    </section>
  );
}

function CourseHeroFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/8 p-4 backdrop-blur">
      <p className="text-xs uppercase tracking-[0.16em] text-white/70">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
