import type { RefObject } from "react";
import { AccentIconBadge } from "../../components/AccentIconBadge";
import { SurfaceCard } from "../../components/SurfaceCard";
import { Button } from "../../components/ui/button";
import type { CourseCatalogEntry } from "../../lib/courseCatalog";
import { capturePostHogEvent, getCourseAnalyticsProperties } from "../../lib/posthog";
import { CourseChecklist } from "./CourseChecklist";

export function CourseDetailsPresentation({
  course,
  courseDetailsSectionRef,
  entryRequirementsRef,
  onOpenEligibilityCheck,
}: {
  course: CourseCatalogEntry;
  courseDetailsSectionRef: RefObject<HTMLElement | null>;
  entryRequirementsRef: RefObject<HTMLDivElement | null>;
  onOpenEligibilityCheck: () => void;
}) {
  return (
    <>
      <section className="bg-[linear-gradient(135deg,#1f2a3a_0%,#16202d_55%,#1f2a3a_100%)] text-white">
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
              <div className="rounded-[28px] border border-white/10 bg-white/8 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.16em] text-white/70">
                  Provider
                </p>
                <p className="mt-2 text-sm font-semibold text-white">{course.provider}</p>
              </div>
              <div className="rounded-[28px] border border-white/10 bg-white/8 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.16em] text-white/70">
                  Duration
                </p>
                <p className="mt-2 text-sm font-semibold text-white">
                  {course.duration || "Flexible study"}
                </p>
              </div>
              <div className="rounded-[28px] border border-white/10 bg-white/8 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.16em] text-white/70">
                  Intake
                </p>
                <p className="mt-2 text-sm font-semibold text-white">
                  {course.intakeLabel}
                </p>
              </div>
            </div>
          </div>

          <SurfaceCard className="rounded-[36px] border-0 bg-[var(--background-soft-blue)] p-6 text-slate-900 shadow-[0_32px_60px_rgba(31, 42, 58,0.25)] sm:p-8">
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
              Accelerated application process
            </h2>
            <CourseChecklist
              items={[
                "Start with a course-specific eligibility check",
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
              Eligibility Check
            </Button>
          </SurfaceCard>
        </div>
      </section>

      <section
        ref={courseDetailsSectionRef}
        className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16"
      >
        <div>
          <h2 className="text-3xl font-bold text-[var(--cta-secondary)]">Course details</h2>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <SurfaceCard className="rounded-[32px] p-6 sm:p-8">
              <h3 className="text-2xl font-bold text-slate-950">Course overview</h3>
              <p className="mt-4 text-base leading-7 text-slate-600">
                {course.description || course.summary}
              </p>
            </SurfaceCard>

            {course.entryRequirements ? (
              <div ref={entryRequirementsRef}>
                <SurfaceCard className="rounded-[32px] p-6 sm:p-8">
                  <h3 className="text-2xl font-bold text-slate-950">
                    Entry requirements
                  </h3>
                  <p className="mt-4 text-base leading-7 text-slate-600">
                    {course.entryRequirements}
                  </p>
                </SurfaceCard>
              </div>
            ) : null}

            {course.recognitionOfPriorLearning ? (
              <SurfaceCard className="rounded-[32px] p-6 sm:p-8">
                <h3 className="text-2xl font-bold text-slate-950">
                  Recognition of prior learning
                </h3>
                <p className="mt-4 text-base leading-7 text-slate-600">
                  {course.recognitionOfPriorLearning}
                </p>
              </SurfaceCard>
            ) : null}
          </div>

          <div className="space-y-6">
            <SurfaceCard className="rounded-[32px] p-6 sm:p-8">
              <h3 className="text-2xl font-bold text-slate-950">Core subjects</h3>
              {course.coreSubjects.length ? (
                <ul className="mt-4 space-y-3">
                  {course.coreSubjects.map((subject) => (
                    <li
                      key={subject}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700"
                    >
                      {subject}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-slate-600">
                  Subject list available on request.
                </p>
              )}
            </SurfaceCard>

            <SurfaceCard className="rounded-[32px] p-6 sm:p-8">
              <h3 className="text-2xl font-bold text-slate-950">Course facts</h3>
              <dl className="mt-4 space-y-4 text-sm text-slate-700">
                {course.subjectArea ? (
                  <div>
                    <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      Subject area
                    </dt>
                    <dd className="mt-1 font-medium">{course.subjectArea}</dd>
                  </div>
                ) : null}
                {course.duration ? (
                  <div>
                    <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      Duration
                    </dt>
                    <dd className="mt-1 font-medium">{course.duration}</dd>
                  </div>
                ) : null}
                {course.feeSummary ? (
                  <div>
                    <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      Fees
                    </dt>
                    <dd className="mt-1 font-medium">{course.feeSummary}</dd>
                  </div>
                ) : null}
                {course.supportOptions.length ? (
                  <div>
                    <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      Support options
                    </dt>
                    <dd className="mt-1 space-y-2">
                      {course.supportOptions.map((option) => (
                        <p key={option} className="leading-6">
                          {option}
                        </p>
                      ))}
                    </dd>
                  </div>
                ) : null}
                {course.feeNotes.length ? (
                  <div>
                    <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      Good to know
                    </dt>
                    <dd className="mt-1 space-y-2">
                      {course.feeNotes.map((note) => (
                        <p key={note} className="leading-6">
                          {note}
                        </p>
                      ))}
                    </dd>
                  </div>
                ) : null}
                {course.outcomes ? (
                  <div>
                    <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      Outcomes
                    </dt>
                    <dd className="mt-1 leading-6">{course.outcomes}</dd>
                  </div>
                ) : null}
              </dl>
            </SurfaceCard>
          </div>
        </div>
      </section>
    </>
  );
}
