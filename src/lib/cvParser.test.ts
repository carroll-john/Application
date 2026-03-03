import { describe, expect, it } from "vitest";
import {
  normalizeEmploymentType,
  normalizeMonth,
  normalizeParsedEmploymentExperiences,
  normalizeYear,
} from "./cvParser";

describe("cvParser helpers", () => {
  it("normalizes employment type aliases", () => {
    expect(normalizeEmploymentType("permanent")).toBe("Full-time");
    expect(normalizeEmploymentType("contractor")).toBe("Contract");
    expect(normalizeEmploymentType("intern")).toBe("Internship");
  });

  it("normalizes month and year values", () => {
    expect(normalizeMonth("Feb")).toBe("February");
    expect(normalizeMonth("2022-09")).toBe("September");
    expect(normalizeYear("Started in 2019")).toBe("2019");
  });

  it("normalizes parsed employment rows and removes duplicates", () => {
    const experiences = normalizeParsedEmploymentExperiences([
      {
        company: "Example Co",
        currentRole: false,
        duties: "Led delivery for enterprise accounts.",
        endMonth: "06",
        endYear: "2024",
        position: "Program Manager",
        startMonth: "Jan",
        startYear: "2022",
        type: "full time",
      },
      {
        company: "Example Co",
        currentRole: false,
        duties: "Led delivery for enterprise accounts.",
        endMonth: "June",
        endYear: "2024",
        position: "Program Manager",
        startMonth: "January",
        startYear: "2022",
        type: "Permanent",
      },
    ]);

    expect(experiences).toHaveLength(1);
    expect(experiences[0]).toMatchObject({
      company: "Example Co",
      currentRole: false,
      duties: "Led delivery for enterprise accounts.",
      endMonth: "June",
      endYear: "2024",
      position: "Program Manager",
      startMonth: "January",
      startYear: "2022",
      type: "Full-time",
    });
  });

  it("clears end dates for current roles", () => {
    const [experience] = normalizeParsedEmploymentExperiences([
      {
        company: "Current Co",
        currentRole: true,
        duties: "Owns the product roadmap.",
        endMonth: "Present",
        endYear: "2026",
        position: "Product Lead",
        startMonth: "March",
        startYear: "2023",
        type: "Part-time",
      },
    ]);

    expect(experience).toMatchObject({
      currentRole: true,
      endMonth: "",
      endYear: "",
    });
  });
});
