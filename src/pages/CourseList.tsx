import { ArrowRight, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AppBrandHeader } from "../components/AppBrandHeader";
import { SurfaceCard } from "../components/SurfaceCard";
import { Button } from "../components/ui/button";
import { getCourseCatalog } from "../lib/courseCatalog";

export default function CourseList() {
  const navigate = useNavigate();
  const courses = getCourseCatalog();

  return (
    <div className="min-h-screen bg-[#f7f7f4]">
      <AppBrandHeader maxWidthClassName="max-w-7xl" />

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--info-border)] bg-[var(--info-bg)] px-4 py-2 text-sm font-medium text-[var(--info-text)]">
            <BookOpen className="h-4 w-4" />
            Explore courses
          </div>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
            Browse courses and start the right application
          </h1>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            Compare providers, run a course-specific eligibility check, then
            sign in to start or resume your application.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {courses.map((course) => (
            <SurfaceCard
              key={course.code}
              className="rounded-[32px] border-slate-200 p-0"
            >
              <div className="flex flex-col p-6 sm:p-8">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-[#E4EFEE] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#084E74]">
                    {course.delivery}
                  </span>
                  {course.categories.map((category) => (
                    <span
                      key={category}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600"
                    >
                      {category}
                    </span>
                  ))}
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                    {course.studyLevel}
                  </span>
                </div>

                <h2 className="mt-4 text-2xl font-bold text-slate-950">
                  {course.title}
                </h2>
                <p className="mt-2 text-sm font-medium text-slate-500">
                  {course.provider}
                </p>
                <p className="mt-4 text-sm leading-6 text-slate-600">
                  {course.summary}
                </p>

                <div className="mt-5 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <span className="block text-xs uppercase tracking-[0.16em] text-slate-500">
                      Intake
                    </span>
                    <span className="mt-1 block font-medium">
                      {course.intakeLabel}
                    </span>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <span className="block text-xs uppercase tracking-[0.16em] text-slate-500">
                      Duration
                    </span>
                    <span className="mt-1 block font-medium">
                      {course.duration || "Flexible study"}
                    </span>
                  </div>
                  {course.feeSummary ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <span className="block text-xs uppercase tracking-[0.16em] text-slate-500">
                        Fees
                      </span>
                      <span className="mt-1 block font-medium">
                        {course.feeSummary}
                      </span>
                    </div>
                  ) : null}
                  {course.supportSummary ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <span className="block text-xs uppercase tracking-[0.16em] text-slate-500">
                        Support
                      </span>
                      <span className="mt-1 block text-slate-600">
                        {course.supportSummary}
                      </span>
                    </div>
                  ) : null}
                </div>

                {course.coreSubjects.length ? (
                  <div className="mt-5">
                    <span className="block text-xs uppercase tracking-[0.16em] text-slate-500">
                      Core subjects
                    </span>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {course.coreSubjects.slice(0, 3).join(" · ")}
                    </p>
                  </div>
                ) : null}

                <div className="mt-6">
                  <Button
                    className="w-full sm:w-auto"
                    onClick={() => navigate(`/courses/${course.code}`)}
                  >
                    View course
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </SurfaceCard>
          ))}
        </div>
      </section>
    </div>
  );
}
