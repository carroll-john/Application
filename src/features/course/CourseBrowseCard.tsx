import type { ReactNode, SyntheticEvent } from "react";
import fallbackCourseImage from "../../assets/studynext/course-discovery-hero.jpg";
import { isUcBrand } from "../../lib/brand";
import type { CourseCatalogEntry } from "../../lib/courseCatalog";
import { getUcCourseCardMedia } from "./ucCourseCardMedia";

interface CourseBrowseCardProps {
  course: CourseCatalogEntry;
  onViewCourse: (courseCode: string) => void;
  variantIndex?: number;
}

interface StudyNextCourseBrowseCardProps {
  appearance?: "catalogue" | "match";
  course: CourseCatalogEntry;
  footer?: ReactNode;
  onViewCourse?: () => void;
  showSummary?: boolean;
  showMedia?: boolean;
  variantIndex?: number;
}

export function CourseBrowseCard({
  course,
  onViewCourse,
  variantIndex = 0,
}: CourseBrowseCardProps) {
  return (
    <StudyNextCourseBrowseCard
      appearance="catalogue"
      course={course}
      showSummary={isUcBrand}
      showMedia
      variantIndex={variantIndex}
      onViewCourse={() => onViewCourse(course.code)}
    />
  );
}

export function StudyNextCourseBrowseCard({
  appearance = "catalogue",
  course,
  footer,
  onViewCourse,
  showSummary = false,
  showMedia = false,
  variantIndex = 0,
}: StudyNextCourseBrowseCardProps) {
  const media = getUcCourseCardMedia(course, variantIndex);
  const facts = [
    course.delivery,
    course.duration || "Flexible study",
    course.intakeLabel,
  ]
    .filter((value): value is string => Boolean(value))
    .filter((value, index, values) => values.indexOf(value) === index);

  function useFallbackImage(event: SyntheticEvent<HTMLImageElement>) {
    const image = event.currentTarget;
    if (image.dataset.fallbackApplied) return;

    image.dataset.fallbackApplied = "true";
    image.src = fallbackCourseImage;
  }

  return (
    <article
      className={`group flex h-full min-w-0 flex-col overflow-hidden bg-white ${
        appearance === "match"
          ? "rounded-[28px] border border-slate-200 shadow-[0_16px_42px_rgba(31,42,58,0.09)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_52px_rgba(31,42,58,0.13)]"
          : "rounded-[24px] border border-slate-200 shadow-[0_10px_30px_rgba(31,42,58,0.07)] transition duration-300 hover:-translate-y-1 hover:border-[var(--sn-mint)]/45 hover:shadow-[0_18px_42px_rgba(31,42,58,0.11)]"
      }`}
      data-studynext-course-card
      data-studynext-course-card-appearance={appearance}
    >
      {showMedia ? (
        <div className="aspect-[4/3] overflow-hidden bg-slate-100">
          <img
            alt={media.alt}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]"
            loading="lazy"
            src={media.src}
            onError={useFallbackImage}
          />
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col p-5 sm:p-6">
        <p className="break-words text-sm font-medium text-slate-600">
          {course.provider}
        </p>
        <div className="mt-2 flex items-start gap-4">
          <h2 className="min-w-0 flex-1 break-words text-xl font-bold leading-[1.28] tracking-[-0.02em] text-slate-950 sm:text-[1.35rem]">
            {course.title}
          </h2>
          {onViewCourse ? (
            <button
              aria-label={`View ${course.title}`}
              className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--sn-mint)] transition hover:bg-[var(--sn-mint)]/10 hover:text-[var(--sn-navy)]"
              type="button"
              onClick={onViewCourse}
            >
              <StudyNextDirectionMark />
            </button>
          ) : null}
        </div>

        {showSummary && course.summary ? (
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-500">
            {course.summary}
          </p>
        ) : null}

        <ul className="mt-auto flex flex-wrap gap-2 pt-5" aria-label="Course details">
          {facts.map((fact) => (
            <li
              key={fact}
              className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600"
            >
              {fact}
            </li>
          ))}
        </ul>
      </div>

      {footer}
    </article>
  );
}

function StudyNextDirectionMark() {
  return (
    <span aria-hidden="true" className="inline-flex items-center -space-x-1">
      {[0, 1, 2].map((index) => (
        <svg
          key={index}
          className="h-6 w-3"
          fill="none"
          viewBox="0 0 10 18"
        >
          <polyline
            points="2,2 7,9 2,16"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.2"
          />
        </svg>
      ))}
    </span>
  );
}
