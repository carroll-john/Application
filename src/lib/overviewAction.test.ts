import { describe, expect, it } from "vitest";
import { getOverviewActionDescriptor } from "./overviewAction";

describe("getOverviewActionDescriptor", () => {
  it("starts new applications at basic information", () => {
    expect(getOverviewActionDescriptor("Basic information", false)).toEqual({
      description:
        "Start Section 1 with your legal name so the rest of the application can build from the right profile details.",
      label: "Next step",
      path: "/section1/basic-info",
      primaryLabel: "Start application",
      sectionLabel: "Section 1",
      title: "Basic information",
    });
  });

  it("routes completed applications to review before submission", () => {
    expect(getOverviewActionDescriptor(null, false)).toEqual({
      description:
        "Your core application steps are in place. Review the details, check any submission-only requirements, and submit when ready.",
      label: "Next step",
      path: "/review",
      primaryLabel: "Go to review & submit",
      sectionLabel: "Section 3",
      title: "Review and submit",
    });
  });

  it("routes submitted applications to the submitted screen", () => {
    expect(getOverviewActionDescriptor("Employment experience", true)).toEqual({
      description:
        "Open the submitted application to review the final details, status, and application number.",
      label: "Application status",
      path: "/submitted",
      primaryLabel: "View submitted application",
      title: "Submitted application",
    });
  });
});
