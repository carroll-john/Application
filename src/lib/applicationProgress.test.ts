import { describe, expect, it } from "vitest";
import { initialApplicationData } from "./applicationData";
import { getCourseByCode } from "./courseCatalog";
import {
  formatApplicationDate,
  getSelectedCourse,
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

  it("returns the matching catalog course from application meta", () => {
    expect(
      getSelectedCourse({
        selectedCourse: {
          code: "mba-online",
          title: "Ignored fallback title",
          intake: "4 Aug 2025",
          provider: "Ignored fallback provider",
        },
      }),
    ).toEqual(getCourseByCode("mba-online"));
  });

  it("falls back to a synthetic course when the code is unknown", () => {
    const course = getSelectedCourse({
      selectedCourse: {
        code: "custom-course",
        intake: "1 Jan 2027",
        provider: "Custom Provider",
        title: "Custom Course",
      },
    });

    expect(course).toMatchObject({
      code: "custom-course",
      provider: "Custom Provider",
      title: "Custom Course",
      intakeLabel: "1 Jan 2027",
    });
  });
});
