import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppBrandHeader } from "../components/AppBrandHeader";
import { AppBrandFooter } from "../components/AppBrandFooter";
import {
  CourseBrowseCard,
  CourseBrowseFilters,
  CourseBrowsePageIntro,
  CourseBrowseResultsPanel,
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
    <div className="min-h-screen bg-[var(--background)]">
      <AppBrandHeader maxWidthClassName="max-w-7xl" />

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <CourseBrowsePageIntro />
        <CourseBrowseFilters
          activeCategory={activeCategory}
          searchQuery={searchQuery}
          onCategoryChange={setActiveCategory}
          onSearchChange={setSearchQuery}
        />
        <CourseBrowseResultsPanel
          resultsState={resultsState}
          onClearFilters={clearFilters}
        />

        <div
          className={
            isUcBrand
              ? "mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3"
              : "mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          }
        >
          {filteredCourses.map((course) => (
            <CourseBrowseCard
              key={course.code}
              course={course}
              onViewCourse={(courseCode) => navigate(`/courses/${courseCode}`)}
            />
          ))}
        </div>
      </section>
      <AppBrandFooter />
    </div>
  );
}
