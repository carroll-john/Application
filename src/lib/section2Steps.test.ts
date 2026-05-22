import { describe, expect, it } from "vitest";
import {
  buildSection2ApplicationStepDefinitions,
  buildSection2RouteAnalyticsDefinitions,
  getSection2EditPath,
  getSection2Step,
  getSection2StepByPath,
  SECTION2_QUALIFICATIONS_PATH,
  section2Steps,
} from "./section2Steps";
import {
  getApplicationStepDefinition,
  getRouteAnalyticsDefinition,
} from "./analytics/applicationSteps";

describe("section2Steps", () => {
  it("starts at the qualifications hub with monotonic funnel order", () => {
    expect(section2Steps[0]?.key).toBe("qualifications");
    expect(getSection2Step("qualifications").pathPattern.test(SECTION2_QUALIFICATIONS_PATH)).toBe(
      true,
    );

    for (let index = 1; index < section2Steps.length; index += 1) {
      expect(section2Steps[index].order).toBeGreaterThan(section2Steps[index - 1].order);
    }
  });

  it("resolves add and edit routes for record pages", () => {
    expect(getSection2StepByPath("/section2/add-employment")?.key).toBe("employment");
    expect(getSection2StepByPath("/section2/edit-employment/job-1")?.key).toBe("employment");
    expect(getSection2EditPath("employment", "job-1")).toBe("/section2/edit-employment/job-1");
  });

  it("derives analytics definitions that resolve Section 2 routes", () => {
    for (const step of section2Steps) {
      const samplePath =
        step.key === "qualifications"
          ? SECTION2_QUALIFICATIONS_PATH
          : step.addPath ?? SECTION2_QUALIFICATIONS_PATH;

      expect(getRouteAnalyticsDefinition(samplePath)?.key).toBe(step.analytics.routeKey);
      expect(getApplicationStepDefinition(samplePath)?.key).toBe(step.analytics.stepKey);
    }

    expect(buildSection2RouteAnalyticsDefinitions()).toHaveLength(section2Steps.length);
    expect(buildSection2ApplicationStepDefinitions()).toHaveLength(section2Steps.length);
  });
});
