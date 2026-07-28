import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { getCourseCatalogFor } from "../../lib/courseCatalog";
import { StudyNextCourseBrowseCard } from "./CourseBrowseCard";

const course = getCourseCatalogFor("uc")[0];

function renderCard(showSummary?: boolean) {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(StudyNextCourseBrowseCard, {
        course,
        showSummary,
      }),
    ),
  );
}

describe("StudyNextCourseBrowseCard", () => {
  it("can retain the UC course summary as catalogue content", () => {
    expect(renderCard(true)).toContain(course.summary);
  });

  it("omits the course summary on the course-match screen", () => {
    const markup = renderCard(false);

    expect(markup).not.toContain(course.summary);
    expect(markup).toContain(course.title);
    expect(markup).toContain(course.delivery);
  });

  it("uses the image-first StudyNext browse-card anatomy", () => {
    const markup = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(StudyNextCourseBrowseCard, {
          course,
          onViewCourse: () => undefined,
          showMedia: true,
          showSummary: true,
        }),
      ),
    );

    expect(markup).toContain("data-studynext-course-card");
    expect(markup).toContain("<img");
    expect(markup).toContain(`View ${course.title}`);
    expect(markup).toContain("Course details");
  });

  it("gives catalogue courses an individual card edge", () => {
    const markup = renderCard(true);

    expect(markup).toContain(
      'data-studynext-course-card-appearance="catalogue"',
    );
    expect(markup).toContain("rounded-[24px]");
    expect(markup).toContain("border-slate-200");
  });

  it("supports the elevated StudyNext treatment used for matched courses", () => {
    const markup = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(StudyNextCourseBrowseCard, {
          appearance: "match",
          course,
          showMedia: true,
        }),
      ),
    );

    expect(markup).toContain('data-studynext-course-card-appearance="match"');
    expect(markup).toContain("rounded-[28px]");
    expect(markup).toContain("<img");
  });
});
