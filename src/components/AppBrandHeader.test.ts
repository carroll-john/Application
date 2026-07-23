import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KeypathTechServiceMark } from "./AppBrandHeader";

function renderServiceMark() {
  return renderToStaticMarkup(createElement(KeypathTechServiceMark));
}

describe("KeypathTechServiceMark", () => {
  it("renders the supplied service-mark hierarchy accessibly", () => {
    const markup = renderServiceMark();

    expect(markup).toContain('aria-label="Powered by KeypathTECH"');
    expect(markup).toContain("data-keypath-tech-service-mark");
    expect(markup).toContain("Powered by");
    expect(markup).toContain("Keypath");
    expect(markup).toContain("TECH");
    expect(markup).toContain("stroke-dasharray=\"12 4\"");
  });

  it("preserves the compact mobile header by revealing the mark from sm", () => {
    const markup = renderServiceMark();

    expect(markup).toContain("hidden");
    expect(markup).toContain("sm:inline-flex");
  });
});
