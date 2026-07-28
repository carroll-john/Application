import { BookOpen } from "lucide-react";

export function CourseBrowsePageIntro() {
  return (
    <div className="max-w-2xl">
      <div className="inline-flex items-center gap-2 rounded-full border border-[var(--info-border)] bg-[var(--info-bg)] px-4 py-2 text-sm font-medium text-[var(--info-text)]">
        <BookOpen className="h-4 w-4" />
        Explore courses
      </div>
      <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
        Browse courses
      </h1>
      <p className="mt-4 text-lg leading-8 text-slate-600">
        Compare the essentials first, then open the full course page when you’re
        ready to check eligibility and apply.
      </p>
    </div>
  );
}
