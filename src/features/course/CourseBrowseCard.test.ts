import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { getCourseCatalogFor } from "../../lib/courseCatalog";
import { UcCourseBrowseCard } from "./CourseBrowseCard";

const course = getCourseCatalogFor("uc")[0];

function renderCard(showSummary?: boolean) {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(UcCourseBrowseCard, {
        course,
        mediaVariantIndex: 0,
        showSummary,
      }),
    ),
  );
}

describe("UcCourseBrowseCard", () => {
  it("shows the course summary by default for the catalogue", () => {
    expect(renderCard()).toContain(course.summary);
  });

  it("can omit the course summary on the Course match screen", () => {
    const markup = renderCard(false);

    expect(markup).not.toContain(course.summary);
    expect(markup).toContain(course.title);
    expect(markup).toContain(course.delivery);
  });
});
