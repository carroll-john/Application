import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppBrandHeader } from "../components/AppBrandHeader";
import { AppBrandFooter } from "../components/AppBrandFooter";
import {
  CourseBrowseCard,
  CourseBrowseFilters,
  CourseBrowseResultsPanel,
  StudyNextHomeHero,
  type CourseCategoryFilter,
} from "../features/course";
import { isUcBrand } from "../lib/brand";
import { getCourseBrowseResultsState } from "../lib/courseBrowse";
import { getCourseCatalog } from "../lib/courseCatalog";

export default function CourseList() {
  const navigate = useNavigate();
  const courses = getCourseCatalog();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<CourseCategoryFilter>("All");
  const [showAssessmentEntry] = useState(() => {
    try {
      return window.sessionStorage.getItem("uc-pilot-cohort") === "treatment";
    } catch {
      return false;
    }
  });
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
    <div className="min-h-screen bg-white">
      <AppBrandHeader
        maxWidthClassName="max-w-[1536px]"
        showApplicantProfileLink={false}
        variant="marketing"
      />

      <StudyNextHomeHero
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <main className="mx-auto max-w-[1536px] px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        {isUcBrand && showAssessmentEntry ? (
          <div className="content-block mb-12 flex flex-wrap items-center justify-between gap-5 border border-[var(--info-border)] bg-[var(--info-bg)] p-6">
            <div>
              <p className="font-semibold text-slate-950">UC pilot assessment</p>
              <p className="mt-1 text-sm text-slate-600">
                Reopen your invitation link to resume your assessment.
              </p>
            </div>
          </div>
        ) : null}

          <div
            id="course-catalogue"
            className="scroll-mt-6"
          >
            <div className="max-w-3xl">
              <h2 className="text-4xl font-extrabold tracking-[-0.03em] text-slate-950 sm:text-5xl">
                All courses
              </h2>
              <p className="mt-4 text-lg leading-8 text-slate-600">
                {isUcBrand
                  ? "Explore 33 online postgraduate courses and choose the next step that fits your goals."
                  : "Explore courses from leading Australian institutions and choose the next step that fits your goals."}
              </p>
            </div>
            <CourseBrowseFilters
              activeCategory={activeCategory}
              searchQuery={searchQuery}
              showSearch={false}
              onCategoryChange={setActiveCategory}
              onSearchChange={setSearchQuery}
            />
            <CourseBrowseResultsPanel
              resultsState={resultsState}
              onClearFilters={clearFilters}
            />

            <div className="mt-7 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {filteredCourses.map((course, index) => (
                <CourseBrowseCard
                  key={course.code}
                  course={course}
                  variantIndex={index}
                  onViewCourse={(courseCode) => navigate(`/courses/${courseCode}`)}
                />
              ))}
            </div>
          </div>
      </main>
      <AppBrandFooter />
    </div>
  );
}
