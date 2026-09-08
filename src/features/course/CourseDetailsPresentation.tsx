import type { RefObject } from "react";
import { SurfaceCard } from "../../components/SurfaceCard";
import type { CourseCatalogEntry } from "../../lib/courseCatalog";
import { CourseDetailsHero } from "./CourseDetailsHero";

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
      <CourseDetailsHero
        course={course}
        onOpenEligibilityCheck={onOpenEligibilityCheck}
      />

      <section
        ref={courseDetailsSectionRef}
        className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10"
      >
        <div>
          <h2 className="text-2xl font-bold text-[var(--cta-secondary)] sm:text-3xl">Course details</h2>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5">
            <SurfaceCard className="rounded-[32px] p-5 sm:p-6">
              <h3 className="text-xl font-bold text-slate-950 sm:text-2xl">Course overview</h3>
              <p className="mt-3 text-base leading-7 text-slate-600">
                {course.description || course.summary}
              </p>
            </SurfaceCard>

            {course.entryRequirements ? (
              <div ref={entryRequirementsRef}>
                <SurfaceCard className="rounded-[32px] p-5 sm:p-6">
                  <h3 className="text-xl font-bold text-slate-950 sm:text-2xl">
                    Entry requirements
                  </h3>
                  <p className="mt-3 text-base leading-7 text-slate-600">
                    {course.entryRequirements}
                  </p>
                </SurfaceCard>
              </div>
            ) : null}

            {course.recognitionOfPriorLearning ? (
              <SurfaceCard className="rounded-[32px] p-5 sm:p-6">
                <h3 className="text-xl font-bold text-slate-950 sm:text-2xl">
                  Recognition of prior learning
                </h3>
                <p className="mt-3 text-base leading-7 text-slate-600">
                  {course.recognitionOfPriorLearning}
                </p>
              </SurfaceCard>
            ) : null}
          </div>

          <div className="space-y-5">
            <SurfaceCard className="rounded-[32px] p-5 sm:p-6">
              <h3 className="text-xl font-bold text-slate-950 sm:text-2xl">Core subjects</h3>
              {course.coreSubjects.length ? (
                <ul className="mt-3 space-y-2.5">
                  {course.coreSubjects.map((subject) => (
                    <li
                      key={subject}
                      className="content-block-compact rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm leading-6 text-slate-700"
                    >
                      {subject}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate-600">
                  Subject list available on request.
                </p>
              )}
            </SurfaceCard>

            <SurfaceCard className="rounded-[32px] p-5 sm:p-6">
              <h3 className="text-xl font-bold text-slate-950 sm:text-2xl">Course facts</h3>
              <dl className="mt-3 space-y-3 text-sm text-slate-700">
                {course.subjectArea ? (
                  <div>
                    <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      Subject area
                    </dt>
                    <dd className="mt-1 font-medium">{course.subjectArea}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    Delivery
                  </dt>
                  <dd className="mt-1 font-medium">{course.delivery}</dd>
                </div>
                {course.sourceUrl ? (
                  <div>
                    <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      Official source
                    </dt>
                    <dd className="mt-1 font-medium">
                      <a
                        className="text-[var(--cta-tertiary-text)] underline underline-offset-4"
                        href={course.sourceUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        University of Canberra course information
                      </a>
                      {course.sourceVerifiedAt ? (
                        <span className="mt-1 block text-xs font-normal text-slate-500">
                          Verified {course.sourceVerifiedAt}
                        </span>
                      ) : null}
                    </dd>
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
