import { describe, expect, it } from "vitest";

import {
  createCourseTransformer,
  parseEntryRequirementThresholds,
} from "./normalize";
import type { RawCourseEntry } from "./types";

/**
 * Characterization tests for the course-catalog normalizer.
 *
 * These lock in the observable behavior of the two public entry points
 * (`parseEntryRequirementThresholds` and `createCourseTransformer`) so the
 * module can be decomposed into focused submodules without regressions.
 */

function makeCourse(overrides: Partial<RawCourseEntry> = {}): RawCourseEntry {
  return {
    course_name: "Master of Business Administration",
    provider_name: "Example University",
    ...overrides,
  };
}

function transform(course: RawCourseEntry, baseCodeCounts: Record<string, number> = {}) {
  return createCourseTransformer(baseCodeCounts)(course);
}

describe("parseEntryRequirementThresholds", () => {
  it("returns an empty object for missing or blank text", () => {
    expect(parseEntryRequirementThresholds()).toEqual({});
    expect(parseEntryRequirementThresholds(null)).toEqual({});
    expect(parseEntryRequirementThresholds("   ")).toEqual({});
  });

  it("infers the qualification level requirement from keywords", () => {
    expect(
      parseEntryRequirementThresholds("Requires a completed bachelor degree.")
        .qualificationLevelRequirement,
    ).toBe("Bachelor degree");
    expect(
      parseEntryRequirementThresholds("A master qualification is expected.")
        .qualificationLevelRequirement,
    ).toBe("Masters degree");
    expect(
      parseEntryRequirementThresholds("Diploma holders may apply.")
        .qualificationLevelRequirement,
    ).toBe("Diploma");
    expect(
      parseEntryRequirementThresholds("Open to all applicants.")
        .qualificationLevelRequirement,
    ).toBeUndefined();
  });

  it("extracts a WAM threshold in either order", () => {
    expect(parseEntryRequirementThresholds("Minimum WAM of 65%").minWam).toBe(65);
    expect(parseEntryRequirementThresholds("65 WAM required").minWam).toBe(65);
  });

  it("extracts a GPA value and scale in either order", () => {
    const ahead = parseEntryRequirementThresholds("GPA of 5.0 on 7.0 scale");
    expect(ahead.minGpaValue).toBe(5);
    expect(ahead.minGpaScale).toBe(7);

    const behind = parseEntryRequirementThresholds("5/7 GPA minimum");
    expect(behind.minGpaValue).toBe(5);
    expect(behind.minGpaScale).toBe(7);
  });

  it("combines all thresholds when present", () => {
    expect(
      parseEntryRequirementThresholds(
        "Bachelor degree with a WAM of 70% or GPA 5.5 out of 7",
      ),
    ).toEqual({
      qualificationLevelRequirement: "Bachelor degree",
      minWam: 70,
      minGpaValue: 5.5,
      minGpaScale: 7,
    });
  });
});

describe("createCourseTransformer", () => {
  describe("course code", () => {
    it("uses the bare slug when the base code is unique", () => {
      expect(transform(makeCourse({ course_name: "Master of Data Science" }), {
        "master-of-data-science": 1,
      }).code).toBe("master-of-data-science");
    });

    it("prefixes the provider slug when the base code collides", () => {
      expect(
        transform(
          makeCourse({
            course_name: "Master of Data Science",
            provider_name: "Example University",
          }),
          { "master-of-data-science": 2 },
        ).code,
      ).toBe("example-university-master-of-data-science");
    });

    it("special-cases the Southern Cross online MBA", () => {
      expect(
        transform(
          makeCourse({
            course_name: "Master of Business Administration (Online)",
            provider_name: "Southern Cross University",
          }),
        ).code,
      ).toBe("mba-online");
    });
  });

  describe("inference", () => {
    it("derives course type and study level from the title", () => {
      expect(transform(makeCourse({ course_name: "Bachelor of Arts" })).studyLevel).toBe(
        "Undergraduate",
      );
      expect(transform(makeCourse({ course_name: "Bachelor of Arts" })).courseType).toBe(
        "Bachelor's",
      );
      expect(
        transform(makeCourse({ course_name: "Graduate Certificate in IT" })).courseType,
      ).toBe("Graduate Certificate");
      expect(transform(makeCourse({ course_name: "Master of Nursing" })).courseType).toBe(
        "Master's",
      );
      expect(transform(makeCourse({ course_name: "Foundation Program" })).courseType).toBe(
        "Course",
      );
    });

    it("tags categories from the subject area", () => {
      expect(
        transform(makeCourse({ subject_area: "Business and Management" })).categories,
      ).toEqual(["Business"]);
      expect(
        transform(makeCourse({ subject_area: "Data Analytics and Cyber Security" }))
          .categories,
      ).toEqual(["Technology"]);
      expect(
        transform(makeCourse({ subject_area: "Public Health and Business" })).categories,
      ).toEqual(["Business", "Health"]);
    });

    it("detects online delivery, defaulting to flexible study", () => {
      expect(
        transform(makeCourse({ course_description: "Study 100% online." })).delivery,
      ).toBe("100% Online");
      expect(transform(makeCourse({ course_description: "On campus." })).delivery).toBe(
        "Flexible study",
      );
    });

    it("infers minimum education from the entry requirements", () => {
      const rules = (text: string) =>
        transform(makeCourse({ entry_requirements: text })).eligibility.rules;
      expect(rules("Requires a PhD")).toContainEqual(
        expect.objectContaining({ minEducation: "Doctorate" }),
      );
      expect(rules("Masters degree required")).toContainEqual(
        expect.objectContaining({ minEducation: "Masters degree" }),
      );
    });
  });

  describe("duration", () => {
    const duration = (raw: string) =>
      transform(makeCourse({ course_duration: raw })).duration;

    it("normalizes full-time-or-equivalent year phrasing", () => {
      expect(duration("2 years full-time or part-time equivalent")).toBe(
        "2 years full-time or part-time equivalent",
      );
    });

    it("converts months to years", () => {
      expect(duration("24 months full-time")).toBe("2 years full-time");
    });

    it("collapses multiple year options into a range", () => {
      expect(duration("Complete in 1 year or 3 years")).toBe("1-3 years");
    });

    it("returns undefined for blank durations", () => {
      expect(duration("")).toBeUndefined();
    });
  });

  describe("fees", () => {
    it("derives a per-year estimate from a per-unit rate", () => {
      const result = transform(
        makeCourse({ tuition_fees: "Tuition is $4,000 per unit." }),
      );
      expect(result.feeSummary).toBe("Approx. $32,000 per year");
      expect(result.feeNotes).toContain("Based on a full-time load of 8 units per year.");
    });

    it("collects support options in canonical order", () => {
      const result = transform(
        makeCourse({
          tuition_fees: "Commonwealth supported places available. FEE-HELP eligible.",
          fee_help_eligibility: "HECS-HELP available.",
        }),
      );
      expect(result.supportOptions).toEqual(["CSP", "FEE-HELP", "HECS-HELP"]);
      expect(result.supportSummary).toBe("CSP · FEE-HELP · HECS-HELP");
    });

    it("falls back to a contact-provider summary for outlier totals", () => {
      const result = transform(
        makeCourse({ tuition_fees: "Total course cost is $400,000." }),
      );
      expect(result.feeSummary).toBe("Contact provider for current fees");
    });

    it("leaves fee fields undefined when no fee data exists", () => {
      const result = transform(makeCourse());
      expect(result.feeSummary).toBeUndefined();
      expect(result.supportSummary).toBeUndefined();
      expect(result.supportOptions).toEqual([]);
      expect(result.feeNotes).toEqual([]);
    });
  });

  describe("intake", () => {
    it("normalizes a recognized month with year", () => {
      expect(
        transform(makeCourse({ intake_start_dates: [{ value: "Starts March 2026" }] }))
          .intakeLabel,
      ).toBe("March 2026");
    });

    it("falls back to term-based month inference", () => {
      expect(
        transform(makeCourse({ intake_start_dates: [{ value: "Semester 1" }] }))
          .intakeLabel,
      ).toBe("March");
    });

    it("uses a default label when no intake data exists", () => {
      expect(transform(makeCourse()).intakeLabel).toBe("Upcoming intake");
    });
  });

  describe("eligibility copy", () => {
    it("builds experience-or-education copy when experience is required", () => {
      const result = transform(
        makeCourse({
          course_name: "Master of Management",
          entry_requirements: "5 years of relevant experience or a bachelor degree.",
        }),
      );
      expect(result.eligibility.rules).toContainEqual(
        expect.objectContaining({ type: "min_education_or_experience" }),
      );
      expect(result.eligibility.ineligibleCopy).toContain("five or more years");
    });

    it("builds education-only copy when required experience resolves to zero", () => {
      // A sub-two-year mention floors the inferred experience minimum to 0,
      // which selects the education-only rule (a missing mention defaults to 3).
      const result = transform(
        makeCourse({
          course_name: "Master of Management",
          entry_requirements: "Bachelor degree with 1 year of study.",
        }),
      );
      expect(result.eligibility.rules).toContainEqual(
        expect.objectContaining({ type: "min_education" }),
      );
      expect(result.eligibility.ineligibleCopy).toBe(
        "Master of Management expects bachelor degree completion.",
      );
    });

    it("produces a success copy referencing the title", () => {
      expect(
        transform(makeCourse({ course_name: "Master of Analytics" })).eligibility
          .successCopy,
      ).toBe("You meet the entry criteria for Master of Analytics.");
    });
  });

  it("trims free-text fields and summarizes the description", () => {
    const result = transform(
      makeCourse({
        course_description:
          "  This program builds leadership skills. It includes a capstone project.  ",
      }),
    );
    expect(result.summary).toBe("This program builds leadership skills.");
    expect(result.description).toBe(
      "This program builds leadership skills. It includes a capstone project.",
    );
  });
});
