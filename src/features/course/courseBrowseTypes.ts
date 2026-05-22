export const COURSE_CATEGORY_FILTERS = [
  "All",
  "Business",
  "Technology",
  "Health",
] as const;

export type CourseCategoryFilter = (typeof COURSE_CATEGORY_FILTERS)[number];
