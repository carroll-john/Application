import { ArrowRight, BookOpen } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppBrandHeader } from "../components/AppBrandHeader";
import { StatusPill } from "../components/StatusPill";
import { SurfaceCard } from "../components/SurfaceCard";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { getCourseBrowseResultsState } from "../lib/courseBrowse";
import { getCourseCatalog } from "../lib/courseCatalog";

const COURSE_CATEGORY_FILTERS = ["All", "Business", "Technology", "Health"] as const;
type CourseCategoryFilter = (typeof COURSE_CATEGORY_FILTERS)[number];

export default function CourseList() {
  const navigate = useNavigate();
  const courses = getCourseCatalog();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<CourseCategoryFilter>("All");
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const totalCourses = courses.length;

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

  const resultsState = useMemo(
    () =>
      getCourseBrowseResultsState({
        activeCategory,
        searchQuery,
        totalCourses,
        visibleCourses: filteredCourses.length,
      }),
    [activeCategory, filteredCourses.length, searchQuery, totalCourses],
  );

  function clearFilters() {
    setSearchQuery("");
    setActiveCategory("All");
  }

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
                Search title, provider, or study area
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

        <SurfaceCard
          className="mt-4 border-[#084E74]/10 bg-[#EAF1F5] p-4 sm:p-5"
        >
          <div
            aria-live="polite"
            className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#084E74]">
                {resultsState.headline}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {resultsState.detail}
              </p>
              {resultsState.activeFilters.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {resultsState.activeFilters.map((filter) => (
                    <StatusPill
                      key={filter.label}
                      className="px-2.5 py-1 text-xs"
                      tone={filter.id === "search" ? "info" : "neutral"}
                    >
                      {filter.label}
                    </StatusPill>
                  ))}
                </div>
              ) : null}
            </div>
            {resultsState.hasActiveFilters ? (
              <Button
                className="sm:shrink-0"
                size="sm"
                type="button"
                variant="neutralOutline"
                onClick={clearFilters}
              >
                Clear filters
              </Button>
            ) : null}
          </div>
        </SurfaceCard>

        <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredCourses.map((course) => (
            <SurfaceCard
              key={course.code}
              className="h-full min-w-0 rounded-[24px] border-slate-200 p-0"
            >
              <div className="flex h-full min-w-0 flex-col p-4">
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

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <CourseComparisonItem
                    label="Next intake"
                    value={course.intakeLabel}
                  />
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

function CourseComparisonItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium leading-6 text-slate-950">
        {value}
      </p>
    </div>
  );
}
