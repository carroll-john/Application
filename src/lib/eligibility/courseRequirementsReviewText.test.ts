import { describe, expect, it } from "vitest";
import { getCourseByCode } from "../courseCatalog/buildCatalog";
import { getGeneratedRequirementsForCourse, getRawGeneratedRequirementsEntry } from "../courseCatalog/requirementsLoader";
import { buildCourseRequirementsPlainReview } from "./courseRequirementsReviewText";
import { BACHELOR_QUALIFICATION_DETAIL_TEXT } from "./requirementPresentation";

describe("courseRequirementsReviewText", () => {
  it("renders a multi-pathway course in plain language", () => {
    const course = getCourseByCode("master-of-health-management");
    expect(course).toBeTruthy();

    const review = buildCourseRequirementsPlainReview(course!, {
      usesMatcher: Boolean(getGeneratedRequirementsForCourse(course!.code)),
    });

    expect(review.pathways.length).toBeGreaterThan(1);
    expect(review.globalRequirements.some((requirement) => requirement.kindLabel.includes("English"))).toBe(
      true,
    );
    expect(review.checklistForApplicant[0]).toMatch(/ONE of/i);
  });

  it("merges paired bachelor completion and level requirements in review output", () => {
    const course = getCourseByCode("mba-online");
    expect(course).toBeTruthy();

    const review = buildCourseRequirementsPlainReview(course!, {
      usesMatcher: Boolean(getGeneratedRequirementsForCourse(course!.code)),
      rawRequirements: getRawGeneratedRequirementsEntry(course!.code),
    });

    const pathwayRequirements = review.pathways[0]?.requirements ?? [];
    const bachelorSummaries = pathwayRequirements.filter((requirement) =>
      requirement.summary.includes("Bachelor degree"),
    );
    const completedSummaries = pathwayRequirements.filter((requirement) =>
      requirement.summary.includes("Must have completed"),
    );

    expect(bachelorSummaries).toHaveLength(1);
    expect(completedSummaries).toHaveLength(0);
    expect(bachelorSummaries[0]?.sourceText).toBe(BACHELOR_QUALIFICATION_DETAIL_TEXT);
  });
});
