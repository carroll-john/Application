import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StudyNextHomeHero } from "./StudyNextHomeHero";

describe("StudyNextHomeHero", () => {
  it("renders the image-led StudyNext discovery search", () => {
    const markup = renderToStaticMarkup(
      createElement(StudyNextHomeHero, {
        searchQuery: "",
        onSearchChange: () => undefined,
      }),
    );

    expect(markup).toContain("data-studynext-home-hero");
    expect(markup).toContain("Take the next step in your career.");
    expect(markup).toContain("Search by subject, course or institution...");
    expect(markup).toContain("business");
    expect(markup).toContain("public policy");
  });
});
