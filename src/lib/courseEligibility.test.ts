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
  experienceOptions: ["Less than 2 years", "2-5 years", "5+ years"],
  goalsOptions: ["Career advancement"],
  ineligibleCopy:
    "This course expects either a bachelor degree or at least two years of experience.",
  rules: [
    {
      type: "min_education_or_experience",
      minEducation: "Bachelor degree",
      minExperienceYears: 2,
    },
  ],
  successCopy: "You meet the entry criteria for this course.",
};

describe("evaluateCourseEligibility", () => {
  it("rejects applicants with high school and less than two years experience", () => {
    expect(
      evaluateCourseEligibility(mbaStyleEligibility, {
        educationLevel: "High school",
        experienceRange: "Less than 2 years",
        goal: "Career advancement",
      }),
    ).toEqual({
      eligible: false,
      reason:
        "This course expects either a bachelor degree or at least two years of experience.",
    });
  });

  it("accepts applicants with a bachelor degree and low experience", () => {
    expect(
      evaluateCourseEligibility(mbaStyleEligibility, {
        educationLevel: "Bachelor degree",
        experienceRange: "Less than 2 years",
        goal: "Career advancement",
      }),
    ).toEqual({
      eligible: true,
      reason: "You meet the entry criteria for this course.",
    });
  });

  it("accepts applicants with high school and at least two years experience", () => {
    expect(
      evaluateCourseEligibility(mbaStyleEligibility, {
        educationLevel: "High school",
        experienceRange: "2-5 years",
        goal: "Career advancement",
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
          experienceRange: "5+ years",
          goal: "Career advancement",
        },
      ),
    ).toEqual({
      eligible: false,
      reason: "This course expects a bachelor degree or higher qualification.",
    });
  });
});
