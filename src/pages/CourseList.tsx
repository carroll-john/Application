import { ArrowRight, BookOpen } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppBrandHeader } from "../components/AppBrandHeader";
import { SurfaceCard } from "../components/SurfaceCard";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { getCourseCatalog } from "../lib/courseCatalog";

const COURSE_CATEGORY_FILTERS = ["All", "Business", "Technology", "Health"] as const;
type CourseCategoryFilter = (typeof COURSE_CATEGORY_FILTERS)[number];

export default function CourseList() {
  const navigate = useNavigate();
  const courses = getCourseCatalog();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<CourseCategoryFilter>("All");
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredCourses = useMemo(
    () =>
      courses.filter((course) => {
        const matchesCategory =
          activeCategory === "All" || course.categories.includes(activeCategory);

        if (!matchesCategory) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        const searchableText = [
          course.title,
          course.provider,
          course.categories.join(" "),
          course.studyLevel ?? "",
          course.courseType ?? "",
        ]
          .join(" ")
          .toLowerCase();

        return searchableText.includes(normalizedQuery);
      }),
    [activeCategory, courses, normalizedQuery],
  );

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

        <SurfaceCard className="mt-8 rounded-[24px] border-slate-200/80 bg-white/90 p-4 sm:p-5">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Input
                aria-label="Search courses"
                className="h-10 rounded-xl border-slate-200 bg-slate-50 px-3 py-2 shadow-none focus:bg-white sm:max-w-xl"
                placeholder="Search courses or providers"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500 sm:shrink-0">
                {filteredCourses.length} courses shown
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {COURSE_CATEGORY_FILTERS.map((category) => (
                <Button
                  key={category}
                  size="sm"
                  type="button"
                  variant={activeCategory === category ? "soft" : "neutralOutline"}
                  onClick={() => setActiveCategory(category)}
                >
                  {category}
                </Button>
              ))}
            </div>
          </div>
        </SurfaceCard>

        <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredCourses.map((course) => (
            <SurfaceCard
              key={course.code}
              className="min-w-0 rounded-[24px] border-slate-200 p-0"
            >
              <div className="flex min-w-0 flex-col p-4">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-[#E4EFEE] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#084E74]">
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

                <dl className="mt-3.5 space-y-2 text-sm text-slate-700">
                  <div className="border-t border-slate-100 pt-2 sm:flex sm:items-start sm:justify-between sm:gap-4">
                    <dt className="text-slate-500">Intake</dt>
                    <dd className="mt-1 break-words font-medium text-slate-950 sm:mt-0 sm:max-w-[65%] sm:text-right">
                      {course.intakeLabel}
                    </dd>
                  </div>
                  <div className="border-t border-slate-100 pt-2 sm:flex sm:items-start sm:justify-between sm:gap-4">
                    <dt className="text-slate-500">Duration</dt>
                    <dd className="mt-1 break-words font-medium text-slate-950 sm:mt-0 sm:max-w-[65%] sm:text-right">
                      {course.duration || "Flexible study"}
                    </dd>
                  </div>
                  <div className="border-t border-slate-100 pt-2 sm:flex sm:items-start sm:justify-between sm:gap-4">
                    <dt className="text-slate-500">Fees</dt>
                    <dd className="mt-1 break-words font-medium text-slate-950 sm:mt-0 sm:max-w-[65%] sm:text-right">
                      {course.feeSummary || "Contact provider"}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4">
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

        {!filteredCourses.length ? (
          <SurfaceCard className="mt-6 rounded-[28px] p-6 text-center sm:p-8">
            <p className="text-lg font-semibold text-slate-900">
              No courses match those filters.
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Try a different search term or reset to all categories.
            </p>
            <div className="mt-5 flex justify-center">
              <Button
                type="button"
                variant="neutralOutline"
                onClick={() => {
                  setSearchQuery("");
                  setActiveCategory("All");
                }}
              >
                Clear filters
              </Button>
            </div>
          </SurfaceCard>
        ) : null}
      </section>
    </div>
  );
}
