import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.doUnmock("../../context/AuthContext");
});

describe("OverviewPage", () => {
  it("renders the UC-branded overview for the UC catalogue context", async () => {
    vi.stubEnv("VITE_APP_BRAND", "uc");
    vi.doMock("../../context/AuthContext", () => ({
      useAuth: () => ({ isAuthenticated: true }),
    }));

    const [{ OverviewPage }, { getCourseCatalogFor }] = await Promise.all([
      import("./OverviewPage"),
      import("../../lib/courseCatalog"),
    ]);
    const course = getCourseCatalogFor("uc").find(
      (entry) => entry.code === "master-of-business-administration-government",
    );

    expect(course).toBeDefined();

    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ["/overview"] },
        createElement(OverviewPage, {
          course: course!,
          nextAction: {
            description: "Default description",
            label: "Next step",
            path: "/section1/basic-info",
            primaryLabel: "Start application",
            sectionLabel: "Section 1",
            title: "Basic information",
          },
          onContinue: () => undefined,
        }),
      ),
    );

    expect(html).toContain("data-uc-brand-header");
    expect(html).toContain('alt="University of Canberra"');
    expect(html).toContain("Application overview");
    expect(html).toContain("Desired course intake");
    expect(html).toContain("Personal details");
    expect(html).toContain("Your qualifications");
    expect(html).toContain("Review and submit");
    expect(html).toContain("Start application");
    expect(html).not.toContain("A University of Canberra business student");
    expect(html).not.toContain("Your UC application");
  });
});
