export const COURSE_CATEGORY_FILTERS = [
  "All",
  "Business",
  "Communication",
  "Built Environment",
  "Technology",
  "Health",
  "Law",
  "Politics & Society",
  "Education",
] as const;

export type CourseCategoryFilter = (typeof COURSE_CATEGORY_FILTERS)[number];
