import { describe, expect, it } from "vitest";
import {
  getSection2SubmissionMissingFields,
  meetsSection2SubmissionRequirement,
} from "./section2Requirements";

describe("section2 submission requirements", () => {
  it("accepts a tertiary qualification on its own", () => {
    expect(
      meetsSection2SubmissionRequirement({
        cvUploaded: false,
        employmentExperiencesCount: 0,
        tertiaryQualificationsCount: 1,
      }),
    ).toBe(true);
  });

  it("accepts CV plus employment without tertiary study", () => {
    expect(
      meetsSection2SubmissionRequirement({
        cvUploaded: true,
        employmentExperiencesCount: 1,
        tertiaryQualificationsCount: 0,
      }),
    ).toBe(true);
  });

  it("returns both missing-field prompts when neither path is satisfied", () => {
    expect(
      getSection2SubmissionMissingFields({
        cvUploaded: false,
        employmentExperiencesCount: 0,
        tertiaryQualificationsCount: 0,
      }),
    ).toEqual([
      "CV upload or a tertiary qualification",
      "Employment experience or a tertiary qualification",
    ]);
  });
});
