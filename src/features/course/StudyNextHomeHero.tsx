import { ChevronRight, Search } from "lucide-react";
import type { FormEvent } from "react";
import heroImage from "../../assets/studynext/course-discovery-hero.jpg";

const POPULAR_SEARCHES = [
  "business",
  "education",
  "technology",
  "health",
  "public policy",
] as const;

interface StudyNextHomeHeroProps {
  onSearchChange: (query: string) => void;
  searchQuery: string;
}

export function StudyNextHomeHero({
  onSearchChange,
  searchQuery,
}: StudyNextHomeHeroProps) {
  function scrollToCourses() {
    document.getElementById("course-catalogue")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    scrollToCourses();
  }

  function selectPopularSearch(query: string) {
    onSearchChange(query);
    window.requestAnimationFrame(scrollToCourses);
  }

  return (
    <section
      aria-labelledby="studynext-home-heading"
      className="relative isolate min-h-[560px] overflow-hidden bg-[var(--sn-navy-deep)] text-white sm:min-h-[640px]"
      data-studynext-home-hero
    >
      <img
        alt=""
        aria-hidden="true"
        className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
        src={heroImage}
      />
      <div className="studynext-discovery-hero-overlay absolute inset-0 -z-10" />

      <div className="mx-auto flex min-h-[560px] max-w-[1536px] flex-col px-5 py-8 sm:min-h-[640px] sm:px-6 sm:py-6 lg:px-8">
        <p className="mb-16 inline-flex items-center gap-2 text-sm font-medium text-white/70 sm:mb-28 lg:mb-32">
          StudyNext Australia
          <ChevronRight aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
        </p>

        <div className="max-w-5xl">
          <h1
            id="studynext-home-heading"
            className="max-w-5xl text-4xl font-extrabold leading-[1.08] tracking-[-0.03em] sm:text-5xl lg:text-[3.4rem]"
          >
            Take the next step in your career.
          </h1>
          <p className="mt-6 max-w-4xl text-base leading-7 text-white/85 sm:text-xl sm:leading-8">
            Compare 33 online postgraduate courses across business, technology,
            education, health and more.
          </p>

          <form className="mt-7 max-w-4xl" role="search" onSubmit={submitSearch}>
            <label className="sr-only" htmlFor="studynext-course-search">
              Search courses
            </label>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-5 top-1/2 h-7 w-7 -translate-y-1/2 text-slate-500"
                strokeWidth={1.8}
              />
              <input
                id="studynext-course-search"
                aria-label="Search courses"
                className="h-[72px] w-full rounded-xl border border-white/15 bg-white py-4 pl-16 pr-5 text-base text-slate-950 shadow-[var(--shadow-search)] outline-none placeholder:text-slate-500 focus:border-[var(--sn-mint)] focus:ring-4 focus:ring-[var(--sn-mint)]/25 sm:text-lg"
                placeholder="Search by subject, course or institution..."
                type="search"
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
              />
              <button className="sr-only rounded-full" type="submit">
                Search courses
              </button>
            </div>
          </form>

          <div aria-label="Popular course searches" className="mt-4 flex max-w-4xl flex-wrap gap-2">
            {POPULAR_SEARCHES.map((query) => (
              <button
                key={query}
                className="rounded-full border border-white/55 bg-black/10 px-3 py-1.5 text-sm font-medium text-white/90 backdrop-blur-[2px] transition hover:border-[var(--sn-mint)] hover:bg-[var(--sn-mint)] hover:text-[var(--sn-navy)]"
                type="button"
                onClick={() => selectPopularSearch(query)}
              >
                {query}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
