import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.doUnmock("../context/AuthContext");
});

async function renderBrandChrome(brand: "studynext" | "uc") {
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
        createElement(AppBrandHeader),
        createElement(AppBrandFooter),
      ),
    ),
  );
}

describe("shared brand chrome", () => {
  it("renders UC's two-level navigation and official-style public footer", async () => {
    const html = await renderBrandChrome("uc");

    expect(html).toContain("data-uc-brand-header");
    expect(html).toContain("University accessibility links");
    expect(html).toContain("Application navigation");
    expect(html).toContain("Online applications");
    const headerHtml = html.slice(
      html.indexOf("<header"),
      html.indexOf("</header>") + "</header>".length,
    );
    expect(headerHtml.match(/Online applications/g)).toHaveLength(1);
    expect(html).toContain("data-uc-brand-footer");
    expect(html).toContain("Other quick links");
    expect(html).toContain("University of Canberra, Bruce ACT 2617 Australia");
    expect(html).toContain("University legal links");
    expect(html).toContain("Private demonstration environment");
  });

  it("keeps the StudyNext header and footer behavior unchanged", async () => {
    const html = await renderBrandChrome("studynext");

    expect(html).toContain("Study");
    expect(html).toContain("Next.");
    expect(html).toContain("Apply");
    expect(html).not.toContain("data-uc-brand-header");
    expect(html).not.toContain("data-uc-brand-footer");
    expect(html).not.toContain("Other quick links");
  });
});
