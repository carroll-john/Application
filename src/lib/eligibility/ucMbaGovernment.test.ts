import { describe, expect, it } from "vitest";
import { getCourseCatalogFor } from "../courseCatalog";
import { aggregateOutcome, evaluateRequirementsWithPathways } from "./matcher";

describe("UC MBA (Government) golden applicant", () => {
  it("routes completed bachelor evidence plus CV evidence to visible manual review", () => {
    const course = getCourseCatalogFor("uc").find(
      (candidate) => candidate.code === "master-of-business-administration-government",
    );
    expect(course?.requirements).toBeDefined();

    const evaluation = evaluateRequirementsWithPathways(
      course?.requirements ?? [],
      {
        applicantDetails: {
          countryOfInstitution: { confidence: 0.99, normalizedValue: "Australia" },
        },
        studyDetails: {
          completionStatus: { confidence: 0.99, normalizedValue: "completed" },
          highestEducationLevel: { confidence: 0.99, normalizedValue: "bachelor" },
          programName: { confidence: 0.99, normalizedValue: "Bachelor of Arts" },
        },
      },
      { completed: true, cvUploaded: true, employmentCount: 7 },
    );

    expect(evaluation.selectedPathwayId).toBe("unrelated-bachelor-experience");
    expect(evaluation.checks.some((check) => check.reasonCode === "QUALIFICATION_LEVEL_MET")).toBe(true);
    expect(evaluation.checks.some((check) => check.reasonCode === "WORK_EXPERIENCE_UNVERIFIED")).toBe(true);
    expect(aggregateOutcome(evaluation.checks)).toEqual({
      outcome: "insufficient_data",
      manualReviewRequired: true,
    });
  });
});
