import { describe, expect, it } from "vitest";
import {
  getSection2SubmissionMissingFields,
  meetsSection2SubmissionRequirement,
} from "./section2Requirements";

function makeCourse(overrides: {
  rules: Array<
    | { type: "min_education"; minEducation: "High school" | "Diploma" | "Bachelor degree" | "Masters degree" | "Doctorate" }
    | {
        type: "min_education_or_experience";
        minEducation: "High school" | "Diploma" | "Bachelor degree" | "Masters degree" | "Doctorate";
        minExperienceYears: number;
      }
  >;
}) {
  return {
    categories: [],
    code: "test-course",
    coreSubjects: [],
    delivery: "Flexible study",
    eligibility: {
      educationOptions: [
        "High school",
        "Diploma",
        "Bachelor degree",
        "Masters degree",
        "Doctorate",
      ],
      experienceOptions: ["Less than 2 years", "2-5 years", "5+ years"],
      goalsOptions: ["Career advancement"],
      rules: overrides.rules,
    },
    feeNotes: [],
    intakeDates: [],
    intakeLabel: "Anytime",
    provider: "Test Provider",
    supportOptions: [],
    title: "Test Course",
  };
}

describe("section2 submission requirements", () => {
  it("accepts a tertiary qualification on its own", () => {
    expect(
      meetsSection2SubmissionRequirement({
        cvUploaded: false,
        employmentExperiencesCount: 0,
        secondaryQualificationsCount: 0,
        selectedCourse: null,
        tertiaryQualifications: [
          {
            id: "ter-1",
            institution: "Uni",
            country: "Australia",
            level: "Bachelor",
            courseName: "Business",
            startMonth: "January",
            startYear: "2020",
            completed: true,
            endMonth: "December",
            endYear: "2022",
          },
        ],
      }),
    ).toBe(true);
  });

  it("accepts CV plus employment without tertiary study", () => {
    expect(
      meetsSection2SubmissionRequirement({
        cvUploaded: true,
        employmentExperiencesCount: 1,
        secondaryQualificationsCount: 0,
        selectedCourse: null,
        tertiaryQualifications: [],
      }),
    ).toBe(true);
  });

  it("returns both missing-field prompts when neither path is satisfied", () => {
    expect(
      getSection2SubmissionMissingFields({
        cvUploaded: false,
        employmentExperiencesCount: 0,
        secondaryQualificationsCount: 0,
        selectedCourse: null,
        tertiaryQualifications: [],
      }),
    ).toEqual([
      "CV upload or a tertiary qualification",
      "Employment experience or a tertiary qualification",
    ]);
  });

  it("accepts a secondary qualification for high-school-entry courses", () => {
    expect(
      meetsSection2SubmissionRequirement({
        cvUploaded: false,
        employmentExperiencesCount: 0,
        secondaryQualificationsCount: 1,
        selectedCourse: makeCourse({
          rules: [{ type: "min_education", minEducation: "High school" }],
        }),
        tertiaryQualifications: [],
      }),
    ).toBe(true);
  });

  it("uses a course-specific education requirement when there is no experience alternate path", () => {
    expect(
      getSection2SubmissionMissingFields({
        cvUploaded: true,
        employmentExperiencesCount: 2,
        secondaryQualificationsCount: 0,
        selectedCourse: makeCourse({
          rules: [{ type: "min_education", minEducation: "Bachelor degree" }],
        }),
        tertiaryQualifications: [],
      }),
    ).toEqual(["Add a bachelor degree or higher qualification"]);
  });

  it("accepts the experience path for courses that explicitly allow it", () => {
    expect(
      meetsSection2SubmissionRequirement({
        cvUploaded: true,
        employmentExperiencesCount: 1,
        secondaryQualificationsCount: 0,
        selectedCourse: makeCourse({
          rules: [
            {
              type: "min_education_or_experience",
              minEducation: "Diploma",
              minExperienceYears: 2,
            },
          ],
        }),
        tertiaryQualifications: [],
      }),
    ).toBe(true);
  });
});
