export interface CourseBrowseActiveFilter {
  id: "category" | "search";
  label: string;
}

interface CourseBrowseResultsStateInput {
  activeCategory: string;
  searchQuery: string;
  totalCourses: number;
  visibleCourses: number;
}

export interface CourseBrowseResultsState {
  activeFilters: CourseBrowseActiveFilter[];
  detail: string;
  hasActiveFilters: boolean;
  headline: string;
  hiddenCourses: number;
}

function formatCourseCount(count: number) {
  return `${count} ${count === 1 ? "course" : "courses"}`;
}

export function getActiveCourseBrowseFilters(
  activeCategory: string,
  searchQuery: string,
): CourseBrowseActiveFilter[] {
  const trimmedQuery = searchQuery.trim();
  const activeFilters: CourseBrowseActiveFilter[] = [];

  if (activeCategory !== "All") {
    activeFilters.push({
      id: "category",
      label: `Category: ${activeCategory}`,
    });
  }

  if (trimmedQuery) {
    activeFilters.push({
      id: "search",
      label: `Search: "${trimmedQuery}"`,
    });
  }

  return activeFilters;
}

export function getCourseBrowseResultsState({
  activeCategory,
  searchQuery,
  totalCourses,
  visibleCourses,
}: CourseBrowseResultsStateInput): CourseBrowseResultsState {
  const activeFilters = getActiveCourseBrowseFilters(activeCategory, searchQuery);
  const hasActiveFilters = activeFilters.length > 0;
  const hiddenCourses = Math.max(totalCourses - visibleCourses, 0);

  if (!hasActiveFilters) {
    return {
      activeFilters,
      detail: "Use search or category filters to narrow the list.",
      hasActiveFilters,
      headline: `Showing all ${formatCourseCount(totalCourses)}`,
      hiddenCourses,
    };
  }

  if (visibleCourses === 0) {
    return {
      activeFilters,
      detail: `Try a broader search or clear filters to see all ${formatCourseCount(totalCourses)} again.`,
      hasActiveFilters,
      headline: "No courses match your current filters",
      hiddenCourses,
    };
  }

  return {
    activeFilters,
    detail:
      hiddenCourses > 0
        ? `${formatCourseCount(hiddenCourses)} hidden by your current filters.`
        : "Your current filters still include every course.",
    hasActiveFilters,
    headline: `Showing ${visibleCourses} of ${formatCourseCount(totalCourses)}`,
    hiddenCourses,
  };
}
