import { SurfaceCard } from "../../components/SurfaceCard";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  COURSE_CATEGORY_FILTERS,
  type CourseCategoryFilter,
} from "./courseBrowseTypes";

interface CourseBrowseFiltersProps {
  activeCategory: CourseCategoryFilter;
  onCategoryChange: (category: CourseCategoryFilter) => void;
  onSearchChange: (query: string) => void;
  searchQuery: string;
}

export function CourseBrowseFilters({
  activeCategory,
  onCategoryChange,
  onSearchChange,
  searchQuery,
}: CourseBrowseFiltersProps) {
  return (
    <SurfaceCard className="mt-8 rounded-[24px] border-slate-200/80 bg-white/90 p-4 sm:p-5">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Input
            aria-label="Search courses"
            className="h-10 rounded-xl border-slate-200 bg-slate-50 px-3 py-2 shadow-none focus:bg-white sm:max-w-xl"
            placeholder="Search courses or providers"
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
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
              onClick={() => onCategoryChange(category)}
            >
              {category}
            </Button>
          ))}
        </div>
      </div>
    </SurfaceCard>
  );
}
