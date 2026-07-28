import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { isUcBrand } from "../../lib/brand";
import {
  COURSE_CATEGORY_FILTERS,
  type CourseCategoryFilter,
} from "./courseBrowseTypes";

interface CourseBrowseFiltersProps {
  activeCategory: CourseCategoryFilter;
  onCategoryChange: (category: CourseCategoryFilter) => void;
  onSearchChange: (query: string) => void;
  searchQuery: string;
  showSearch?: boolean;
}

export function CourseBrowseFilters({
  activeCategory,
  onCategoryChange,
  onSearchChange,
  searchQuery,
  showSearch = true,
}: CourseBrowseFiltersProps) {
  return (
    <div className="mt-8 border-y border-slate-200 bg-white py-5">
      <div className="flex flex-col gap-4">
        {showSearch ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Input
              aria-label="Search courses"
              className="h-10 rounded-xl border-slate-200 bg-slate-50 px-3 py-2 shadow-none focus:bg-white sm:max-w-xl"
              placeholder={
                isUcBrand ? "Search courses" : "Search courses or providers"
              }
              type="search"
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
            />
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500 sm:shrink-0">
              Search title, provider, or study area
            </p>
          </div>
        ) : null}
        <div
          aria-label="Filter courses by study area"
          className="flex gap-2 overflow-x-auto pb-1"
        >
          {COURSE_CATEGORY_FILTERS.map((category) => (
            <Button
              className="shrink-0 rounded-lg"
              key={category}
              size="sm"
              type="button"
              variant={activeCategory === category ? "soft" : "neutralOutline"}
              onClick={() => onCategoryChange(category)}
            >
              {category}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
