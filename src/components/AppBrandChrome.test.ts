import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.doUnmock("../context/AuthContext");
});

async function renderBrandChrome(
  brand: "studynext" | "uc",
  variant: "application" | "marketing" = "application",
) {
  vi.stubEnv("VITE_APP_BRAND", brand);
  vi.doMock("../context/AuthContext", () => ({
    useAuth: () => ({ isAuthenticated: false }),
  }));

  const [{ AppBrandHeader }, { AppBrandFooter }] = await Promise.all([
    import("./AppBrandHeader"),
    import("./AppBrandFooter"),
  ]);

  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: ["/"] },
      createElement(
        "div",
        null,
        createElement(AppBrandHeader, { variant }),
        createElement(AppBrandFooter),
      ),
    ),
  );
}

describe("shared brand chrome", () => {
  it("uses StudyNext application chrome for the UC catalogue context", async () => {
    const html = await renderBrandChrome("uc");

    expect(html).toContain("data-studynext-brand-header");
    expect(html).toContain("Study");
    expect(html).toContain("Next.");
    expect(html).toContain("Apply");
    expect(html).not.toContain("data-uc-brand-header");
    expect(html).not.toContain("data-uc-brand-footer");
    expect(html).not.toContain("University of Canberra, Bruce ACT 2617 Australia");
  });

  it("keeps the same StudyNext header and footer behavior for the default catalogue", async () => {
    const html = await renderBrandChrome("studynext");

    expect(html).toContain("data-studynext-brand-header");
    expect(html).toContain("Study");
    expect(html).toContain("Next.");
    expect(html).toContain("Apply");
    expect(html).not.toContain("data-uc-brand-header");
    expect(html).not.toContain("data-uc-brand-footer");
    expect(html).not.toContain("Other quick links");
  });

  it("offers StudyNext marketing navigation on course discovery", async () => {
    const html = await renderBrandChrome("uc", "marketing");

    expect(html).toContain("data-studynext-marketing-header");
    expect(html).toContain("Courses");
    expect(html).toContain("Institutions");
    expect(html).toContain("Resources");
    expect(html).not.toContain("brand-service-label");
  });
});
