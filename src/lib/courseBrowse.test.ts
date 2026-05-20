import { describe, expect, it } from "vitest";
import {
  getActiveCourseBrowseFilters,
  getCourseBrowseResultsState,
} from "./courseBrowse";

describe("getActiveCourseBrowseFilters", () => {
  it("returns no active filters when browse is unfiltered", () => {
    expect(getActiveCourseBrowseFilters("All", "   ")).toEqual([]);
  });

  it("returns category and search filters when both are active", () => {
    expect(getActiveCourseBrowseFilters("Technology", " data ")).toEqual([
      { id: "category", label: "Category: Technology" },
      { id: "search", label: 'Search: "data"' },
    ]);
  });
});

describe("getCourseBrowseResultsState", () => {
  it("describes the default browse state", () => {
    expect(
      getCourseBrowseResultsState({
        activeCategory: "All",
        searchQuery: "",
        totalCourses: 38,
        visibleCourses: 38,
      }),
    ).toEqual({
      activeFilters: [],
      detail: "Use search or category filters to narrow the list.",
      hasActiveFilters: false,
      headline: "Showing all 38 courses",
      hiddenCourses: 0,
    });
  });

  it("describes filtered results and hidden course count", () => {
    expect(
      getCourseBrowseResultsState({
        activeCategory: "Business",
        searchQuery: "mba",
        totalCourses: 38,
        visibleCourses: 4,
      }),
    ).toEqual({
      activeFilters: [
        { id: "category", label: "Category: Business" },
        { id: "search", label: 'Search: "mba"' },
      ],
      detail: "34 courses hidden by your current filters.",
      hasActiveFilters: true,
      headline: "Showing 4 of 38 courses",
      hiddenCourses: 34,
    });
  });

  it("describes the empty filtered state", () => {
    expect(
      getCourseBrowseResultsState({
        activeCategory: "Health",
        searchQuery: "cyber security",
        totalCourses: 38,
        visibleCourses: 0,
      }),
    ).toEqual({
      activeFilters: [
        { id: "category", label: "Category: Health" },
        { id: "search", label: 'Search: "cyber security"' },
      ],
      detail: "Try a broader search or clear filters to see all 38 courses again.",
      hasActiveFilters: true,
      headline: "No courses match your current filters",
      hiddenCourses: 38,
    });
  });
});
