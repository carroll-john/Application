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
  it("renders the UC course image, useful facts and purposeful application sections", async () => {
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
          courseMedia: {
            alt: "A University of Canberra business student",
            src: "/content/dam/uc/imagery/faculties/business/business-meets-govt.jpg",
          },
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

    expect(html).toContain("A University of Canberra business student");
    expect(html).toContain("Your UC application");
    expect(html).toContain("Next intake");
    expect(html).toContain("Study mode");
    expect(html).toContain("Study length");
    expect(html).toContain("About you");
    expect(html).toContain("Study and experience");
    expect(html).toContain("Check and submit");
    expect(html).toContain("Start my application");
    expect(html).not.toContain("Application Overview");
  });
});
