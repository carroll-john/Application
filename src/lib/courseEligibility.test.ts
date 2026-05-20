import { describe, expect, it } from "vitest";
import { evaluateCourseEligibility, type CourseEligibilityConfig } from "./courseEligibility";

const mbaStyleEligibility: CourseEligibilityConfig = {
  educationOptions: [
    "High school",
    "Diploma",
    "Bachelor degree",
    "Masters degree",
    "Doctorate",
  ],
  experienceOptions: ["1-2 years", "3-5 years", "5 years plus"],
  ineligibleCopy:
    "This course expects either a bachelor degree or at least three years of experience.",
  rules: [
    {
      type: "min_education_or_experience",
      minEducation: "Bachelor degree",
      minExperienceYears: 3,
    },
  ],
  successCopy: "You meet the entry criteria for this course.",
};

describe("evaluateCourseEligibility", () => {
  it("rejects applicants with high school and less than three years experience", () => {
    expect(
      evaluateCourseEligibility(mbaStyleEligibility, {
        educationLevel: "High school",
        experienceRange: "1-2 years",
      }),
    ).toEqual({
      eligible: false,
      reason:
        "This course expects either a bachelor degree or at least three years of experience.",
    });
  });

  it("accepts applicants with a bachelor degree and low experience", () => {
    expect(
      evaluateCourseEligibility(mbaStyleEligibility, {
        educationLevel: "Bachelor degree",
        experienceRange: "1-2 years",
      }),
    ).toEqual({
      eligible: true,
      reason: "You meet the entry criteria for this course.",
    });
  });

  it("accepts applicants with high school and at least three years experience", () => {
    expect(
      evaluateCourseEligibility(mbaStyleEligibility, {
        educationLevel: "High school",
        experienceRange: "3-5 years",
      }),
    ).toEqual({
      eligible: true,
      reason: "You meet the entry criteria for this course.",
    });
  });

  it("does not treat experience as an alternate path when the course requires education only", () => {
    expect(
      evaluateCourseEligibility(
        {
          ...mbaStyleEligibility,
          ineligibleCopy:
            "This course expects a bachelor degree or higher qualification.",
          rules: [
            {
              type: "min_education",
              minEducation: "Bachelor degree",
            },
          ],
        },
        {
          educationLevel: "High school",
          experienceRange: "5 years plus",
        },
      ),
    ).toEqual({
      eligible: false,
      reason: "This course expects a bachelor degree or higher qualification.",
    });
  });
});
