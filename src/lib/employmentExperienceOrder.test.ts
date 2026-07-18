import { describe, expect, it } from "vitest";
import type { EmploymentExperience } from "./applicationData";
import { orderEmploymentExperiencesByMostRecent } from "./employmentExperienceOrder";

function experience(
  id: string,
  overrides: Partial<EmploymentExperience> = {},
): EmploymentExperience {
  return {
    id,
    company: "Company",
    position: "Role",
    type: "Full-time",
    startMonth: "January",
    startYear: "2020",
    endMonth: "January",
    endYear: "2021",
    currentRole: false,
    duties: "",
    ...overrides,
  };
}

describe("orderEmploymentExperiencesByMostRecent", () => {
  it("places current roles first and orders them by start date", () => {
    const experiences = [
      experience("older-current", {
        currentRole: true,
        endMonth: "",
        endYear: "",
        startMonth: "March",
        startYear: "2022",
      }),
      experience("latest-ended", {
        endMonth: "June",
        endYear: "2025",
      }),
      experience("newer-current", {
        currentRole: true,
        endMonth: "",
        endYear: "",
        startMonth: "July",
        startYear: "2024",
      }),
    ];

    expect(
      orderEmploymentExperiencesByMostRecent(experiences).map(({ id }) => id),
    ).toEqual(["newer-current", "older-current", "latest-ended"]);
  });

  it("orders completed roles by end date, then start date", () => {
    const experiences = [
      experience("old", { endMonth: "December", endYear: "2022" }),
      experience("same-end-older-start", {
        endMonth: "May",
        endYear: "2024",
        startMonth: "January",
        startYear: "2020",
      }),
      experience("same-end-newer-start", {
        endMonth: "May",
        endYear: "2024",
        startMonth: "February",
        startYear: "2023",
      }),
    ];

    expect(
      orderEmploymentExperiencesByMostRecent(experiences).map(({ id }) => id),
    ).toEqual(["same-end-newer-start", "same-end-older-start", "old"]);
  });

  it("falls back to start date and preserves source order when dates are equal", () => {
    const experiences = [
      experience("undated-first", {
        startMonth: "",
        startYear: "",
        endMonth: "",
        endYear: "",
      }),
      experience("dated-from-start", {
        startMonth: "9",
        startYear: "2023",
        endMonth: "",
        endYear: "",
      }),
      experience("undated-second", {
        startMonth: "",
        startYear: "",
        endMonth: "",
        endYear: "",
      }),
    ];

    const ordered = orderEmploymentExperiencesByMostRecent(experiences);

    expect(ordered.map(({ id }) => id)).toEqual([
      "dated-from-start",
      "undated-first",
      "undated-second",
    ]);
    expect(experiences.map(({ id }) => id)).toEqual([
      "undated-first",
      "dated-from-start",
      "undated-second",
    ]);
  });
});
