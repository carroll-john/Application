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
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--info-border)] bg-[var(--info-bg)] px-4 py-2 text-sm font-medium text-[var(--info-text)]">
            <BookOpen className="h-4 w-4" />
            Explore courses
          </div>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
            Browse courses
          </h1>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            Compare the essentials first, then open the full course page when
            you&apos;re ready to check eligibility and apply.
          </p>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {courses.map((course) => (
            <SurfaceCard
              key={course.code}
              className="min-w-0 h-full rounded-[28px] border-slate-200 p-0"
            >
              <div className="flex h-full min-w-0 flex-col p-5">
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
                </div>

                <p className="mt-4 break-words text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {course.provider}
                </p>
                <h2 className="mt-2 break-words text-xl font-bold leading-tight text-slate-950">
                  {course.title}
                </h2>

                <dl className="mt-5 space-y-3 text-sm text-slate-700">
                  <div className="border-t border-slate-100 pt-3 sm:flex sm:items-start sm:justify-between sm:gap-4">
                    <dt className="text-slate-500">Intake</dt>
                    <dd className="mt-1 break-words font-medium text-slate-950 sm:mt-0 sm:max-w-[65%] sm:text-right">
                      {course.intakeLabel}
                    </dd>
                  </div>
                  <div className="border-t border-slate-100 pt-3 sm:flex sm:items-start sm:justify-between sm:gap-4">
                    <dt className="text-slate-500">Duration</dt>
                    <dd className="mt-1 break-words font-medium text-slate-950 sm:mt-0 sm:max-w-[65%] sm:text-right">
                      {course.duration || "Flexible study"}
                    </dd>
                  </div>
                  <div className="border-t border-slate-100 pt-3 sm:flex sm:items-start sm:justify-between sm:gap-4">
                    <dt className="text-slate-500">Fees</dt>
                    <dd className="mt-1 break-words font-medium text-slate-950 sm:mt-0 sm:max-w-[65%] sm:text-right">
                      {course.feeSummary || "Contact provider"}
                    </dd>
                  </div>
                </dl>

                {course.supportSummary ? (
                  <p className="mt-4 text-xs leading-5 text-slate-500">
                    Support options: {course.supportSummary}
                  </p>
                ) : null}

                <div className="mt-auto pt-5">
                  <Button
                    className="w-full"
                    size="sm"
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
