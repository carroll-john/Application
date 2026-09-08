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
import {
  shouldShowUcCourseCatalogue,
  UcRplCourseMatcher,
  type UcRplAssessmentStage,
} from "../features/ucRpl";
import { isUcBrand } from "../lib/brand";
import { getCourseBrowseResultsState } from "../lib/courseBrowse";
import { getCourseCatalog } from "../lib/courseCatalog";

export default function CourseList() {
  const navigate = useNavigate();
  const courses = getCourseCatalog();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<CourseCategoryFilter>("All");
  const [ucRplStage, setUcRplStage] =
    useState<UcRplAssessmentStage>("intro");
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
  const showCourseCatalogue =
    !isUcBrand || shouldShowUcCourseCatalogue(ucRplStage);

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

      {!isUcBrand || ucRplStage === "intro" ? (
        <StudyNextHomeHero
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      ) : null}

      <main className="mx-auto max-w-[1536px] px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        {isUcBrand ? (
          <div id="experience-assessment">
            <UcRplCourseMatcher
              courses={courses}
              stage={ucRplStage}
              onStageChange={setUcRplStage}
            />
          </div>
        ) : null}

        {showCourseCatalogue ? (
          <div
            id="course-catalogue"
            className={isUcBrand ? "scroll-mt-6 pt-6" : "scroll-mt-6"}
          >
            <div className="max-w-3xl">
              <h2 className="text-3xl font-extrabold tracking-[-0.03em] text-slate-950 sm:text-4xl">
                All courses
              </h2>
              <p className="mt-2 text-base leading-7 text-slate-600 sm:mt-3 sm:text-lg sm:leading-8">
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

            <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
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
        ) : null}
      </main>
      <AppBrandFooter />
    </div>
  );
}
