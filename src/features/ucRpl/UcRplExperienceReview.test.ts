import { describe, expect, it } from "vitest";
import type { TertiaryQualification } from "../../lib/applicationData";
import { formatUcExtractedQualificationDetail } from "./UcRplExperienceReview";

function qualification(
  overrides: Partial<TertiaryQualification> = {},
): TertiaryQualification {
  return {
    id: "qualification-1",
    completed: false,
    country: "Australia",
    courseName: "Bachelor of Business (Management)",
    endMonth: "August",
    endYear: "2025",
    institution: "Harbour City University",
    level: "Bachelor Degree",
    startMonth: "February",
    startYear: "2024",
    ...overrides,
  };
}

describe("formatUcExtractedQualificationDetail", () => {
  it("does not describe an incomplete qualification as completed", () => {
    expect(formatUcExtractedQualificationDetail(qualification())).toBe(
      "Bachelor Degree · Harbour City University · Incomplete (ended 2025)",
    );
  });

  it("keeps the completion year for a completed qualification", () => {
    expect(
      formatUcExtractedQualificationDetail(
        qualification({ completed: true }),
      ),
    ).toBe(
      "Bachelor Degree · Harbour City University · Completed 2025",
    );
  });
});
