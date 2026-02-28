import { describe, expect, it } from "vitest";
import { initialApplicationData } from "./applicationData";
import {
  formatApplicationDate,
  hasStartedApplication,
  isApplicationSubmitted,
} from "./applicationProgress";

describe("application progress helpers", () => {
  it("treats the initial data shape as not started", () => {
    expect(hasStartedApplication(initialApplicationData)).toBe(false);
  });

  it("treats entered personal details as a started application", () => {
    expect(
      hasStartedApplication({
        ...initialApplicationData,
        personalDetails: {
          ...initialApplicationData.personalDetails,
          firstName: "John",
        },
      }),
    ).toBe(true);
  });

  it("detects submitted applications from applicationMeta", () => {
    expect(
      isApplicationSubmitted({
        ...initialApplicationData,
        applicationMeta: {
          submittedAt: "2026-03-01T00:00:00.000Z",
        },
      }),
    ).toBe(true);
  });

  it("formats application dates for AU display", () => {
    expect(formatApplicationDate("2026-03-01T00:00:00.000Z")).toBe("1 Mar 2026");
  });
});
